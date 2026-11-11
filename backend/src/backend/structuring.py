import logging
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Protocol

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints, ValidationError
from starlette.concurrency import run_in_threadpool

from backend.settings import Settings, get_settings
from backend.sheets import Sheet, missing_fields

logger = logging.getLogger(__name__)

# A fast 2-minute note is about 2,400 chars: about 2x margin. The trial checks real lengths.
MAX_TEXT_CHARS = 5_000


class StructuringError(Exception):
    """The provider failed, could not be reached, or gave no usable answer.

    The message stays server-side.
    """


class StructuringTimeout(StructuringError):
    """The provider did not answer in time."""


@dataclass(frozen=True)
class StructuringResult:
    """What the model answered, before any validation.

    `raw` is the model's JSON text as received: the endpoint validates it, so a bad
    answer still reports the tokens it cost. Tokens are None if the provider omits them.
    """

    raw: str
    input_tokens: int | None
    output_tokens: int | None


class Structurer(Protocol):
    """Turns a transcript into a sheet, as raw JSON. The model is fixed by the
    implementation.

    Implementations raise StructuringTimeout on timeout and StructuringError on any
    other provider or network failure, translating their own exceptions.
    """

    def structure(self, text: str) -> StructuringResult: ...


class OpenAIStructurer:
    """Structures transcripts with the OpenAI API. The call itself comes in a later
    task of spec 04; until then no route uses it."""

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def structure(self, text: str) -> StructuringResult:
        raise NotImplementedError


@lru_cache(maxsize=1)
def _openai_structurer(api_key: str, model: str) -> OpenAIStructurer:
    """One client per key and model, so its HTTP connections are reused."""
    return OpenAIStructurer(api_key=api_key, model=model)


def get_structurer(settings: Annotated[Settings, Depends(get_settings)]) -> Structurer:
    """FastAPI dependency for the structurer. Tests override it with a fake."""
    if settings.openai_api_key is None:
        raise HTTPException(status_code=503, detail="Structuring is not configured")
    return _openai_structurer(settings.openai_api_key, settings.structuring_model)


class DraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TEXT_CHARS)
    ]


class DraftOutput(BaseModel):
    """The shape the model must answer with. `strict_schema()` builds the schema
    sent to the provider from this same model."""

    model_config = ConfigDict(extra="forbid", strict=True)

    is_preparation: bool
    sheet: Sheet | None


# What strict mode needs to constrain the shape. Titles, descriptions, defaults and the
# numeric and length limits are dropped: Pydantic enforces the limits on our side.
_STRICT_KEYWORDS = ("type", "enum", "anyOf", "$ref", "items")


def _strict(node: dict[str, Any]) -> dict[str, Any]:
    """One schema node, keeping only `_STRICT_KEYWORDS`, with its children made strict."""
    strict = {key: node[key] for key in _STRICT_KEYWORDS if key in node}
    if "anyOf" in strict:
        strict["anyOf"] = [_strict(option) for option in strict["anyOf"]]
    if "items" in strict:
        strict["items"] = _strict(strict["items"])
    if "properties" in node:
        properties = {name: _strict(child) for name, child in node["properties"].items()}
        strict["properties"] = properties
        # Strict mode has no optional fields: a field that can be absent must be nullable.
        strict["required"] = list(properties)
        strict["additionalProperties"] = False
    return strict


def strict_schema(model: type[BaseModel] = DraftOutput) -> dict[str, Any]:
    """The JSON schema of `model` in the form the provider's strict mode accepts.

    Generated from the Pydantic model, so the units and fields have one source.
    JSON names are used (`yield`, not `yield_`).
    """
    schema = model.model_json_schema(by_alias=True)
    strict = _strict(schema)
    if "$defs" in schema:
        strict["$defs"] = {name: _strict(child) for name, child in schema["$defs"].items()}
    return strict


class DraftResponse(BaseModel):
    is_preparation: bool
    sheet: Sheet | None
    missing: list[str]


def log_structuring(
    status: int, chars: int, duration_ms: int, result: StructuringResult | None
) -> None:
    """The only log line for a structuring call: never the text, the output or the sheet."""
    input_tokens = None if result is None else result.input_tokens
    output_tokens = None if result is None else result.output_tokens
    logger.info(
        "structuring status=%d chars=%s duration_ms=%s input_tokens=%s output_tokens=%s",
        status,
        chars,
        duration_ms,
        "-" if input_tokens is None else input_tokens,
        "-" if output_tokens is None else output_tokens,
    )


def draft_from_output(raw: str) -> DraftResponse:
    """Validate the model's answer and build the response, or raise a generic 502."""
    # A validation error quotes the model output, which holds the chef's recipe: drop it.
    try:
        output = DraftOutput.model_validate_json(raw)
    except ValidationError:
        raise HTTPException(status_code=502, detail="Structuring failed") from None

    if not output.is_preparation:
        # A sheet sent along with "not a preparation" is ignored.
        return DraftResponse(is_preparation=False, sheet=None, missing=[])
    if output.sheet is None:
        raise HTTPException(status_code=502, detail="Structuring failed")
    return DraftResponse(
        is_preparation=True, sheet=output.sheet, missing=missing_fields(output.sheet)
    )


# Mounted inside the protected router in main.py, so it requires a token.
router = APIRouter()


@router.post("/drafts")
async def create_draft(
    body: DraftRequest,
    structurer: Annotated[Structurer, Depends(get_structurer)],
) -> DraftResponse:
    # The structurer blocks on a network call; keep it off the event loop.
    # Details are dropped (`from None`): provider messages may echo the key or request ids.
    started = time.perf_counter()
    # Anything not handled below reaches the client as a 500.
    status = 500
    result: StructuringResult | None = None
    try:
        result = await run_in_threadpool(structurer.structure, body.text)
        response = draft_from_output(result.raw)
        status = 200
        return response
    except StructuringTimeout:
        status = 504
        raise HTTPException(status_code=504, detail="Structuring timed out") from None
    except StructuringError:
        status = 502
        raise HTTPException(status_code=502, detail="Structuring failed") from None
    except HTTPException as error:
        # An invalid output: its tokens were still paid for, so they are logged.
        status = error.status_code
        raise
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000)
        log_structuring(status, len(body.text), duration_ms, result)

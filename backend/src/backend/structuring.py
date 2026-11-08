from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Protocol

from fastapi import Depends, HTTPException

from backend.settings import Settings, get_settings


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

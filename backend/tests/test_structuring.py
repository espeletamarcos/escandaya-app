import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from conftest import ClientFactory, FakeStructurer, make_settings
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from backend.settings import Settings
from backend.structuring import (
    MAX_TEXT_CHARS,
    OpenAIStructurer,
    Structurer,
    StructuringError,
    StructuringResult,
    StructuringTimeout,
    get_structurer,
    strict_schema,
)


def test_get_structurer_is_unavailable_without_a_key() -> None:
    with pytest.raises(HTTPException) as error:
        get_structurer(make_settings())

    assert error.value.status_code == 503
    assert error.value.detail == "Structuring is not configured"


def test_get_structurer_uses_the_key_and_the_configured_model() -> None:
    settings = Settings(
        access_tokens=(),
        openai_api_key="sk-test",
        transcription_model="any-transcription-model",
        structuring_model="some-structuring-model",
    )

    structurer = get_structurer(settings)

    assert isinstance(structurer, OpenAIStructurer)
    assert structurer.api_key == "sk-test"
    assert structurer.model == "some-structuring-model"


def test_get_structurer_reuses_the_same_instance() -> None:
    settings = make_settings(openai_api_key="sk-test")

    assert get_structurer(settings) is get_structurer(settings)


def test_a_timeout_is_a_structuring_error() -> None:
    # The endpoint catches the timeout first, then every other StructuringError.
    assert issubclass(StructuringTimeout, StructuringError)


def test_fake_structurer_returns_raw_answer_and_records_calls() -> None:
    fake = FakeStructurer(raw='{"is_preparation": false, "sheet": null}')
    structurer: Structurer = fake

    result = structurer.structure("hola, qué tal")

    assert result == StructuringResult(
        raw='{"is_preparation": false, "sheet": null}', input_tokens=120, output_tokens=80
    )
    assert fake.calls == ["hola, qué tal"]


def test_fake_structurer_can_return_bad_json() -> None:
    assert FakeStructurer(raw="not json {").structure("texto").raw == "not json {"


def test_fake_structurer_can_fail() -> None:
    fake = FakeStructurer(error=StructuringTimeout())

    with pytest.raises(StructuringTimeout):
        fake.structure("texto")
    assert fake.calls == ["texto"]


def test_make_client_installs_the_fake_structurer(make_client: ClientFactory) -> None:
    fake = FakeStructurer()
    client = make_client(structurer=fake)

    override = client.app.dependency_overrides[get_structurer]
    assert override() is fake


TOKENS = ("chef-token",)
AUTH = {"Authorization": "Bearer chef-token"}

TUNA_SHEET = {
    "name": "Tartar de atún",
    "yield": {"quantity": 2, "unit": "kg", "estimated": True},
    "covers": {"value": None, "estimated": False},
    "ingredients": [
        {"name": "Atún rojo", "quantity": 1.5, "unit": "kg", "estimated": False},
        {"name": "Cebollino", "quantity": None, "unit": None, "estimated": False},
        {"name": "Salsa de soja", "quantity": 100, "unit": None, "estimated": False},
    ],
}


def preparation(sheet: dict) -> str:
    return json.dumps({"is_preparation": True, "sheet": sheet})


def post_text(client: TestClient, body: object) -> httpx.Response:
    return client.post("/api/drafts", json=body, headers=AUTH)


def test_draft_returns_the_sheet_and_its_missing_data(make_client: ClientFactory) -> None:
    fake = FakeStructurer(raw=preparation(TUNA_SHEET))
    client = make_client(TOKENS, structurer=fake)

    response = post_text(client, {"text": "Tartar de atún, unos dos kilos..."})

    assert response.status_code == 200
    assert response.json() == {
        "is_preparation": True,
        # The JSON key is `yield`, not the Python field name `yield_`.
        "sheet": {
            **TUNA_SHEET,
            "yield": {"quantity": 2.0, "unit": "kg", "estimated": True},
            "ingredients": [
                {"name": "Atún rojo", "quantity": 1.5, "unit": "kg", "estimated": False},
                {"name": "Cebollino", "quantity": None, "unit": None, "estimated": False},
                {"name": "Salsa de soja", "quantity": 100.0, "unit": None, "estimated": False},
            ],
        },
        "missing": [
            "covers",
            "ingredients.1.quantity",
            "ingredients.1.unit",
            "ingredients.2.unit",
        ],
    }


def test_draft_with_nothing_missing_has_an_empty_list(make_client: ClientFactory) -> None:
    sheet = {
        "name": "Caldo",
        "yield": {"quantity": 5, "unit": "l", "estimated": False},
        "covers": {"value": 20, "estimated": True},
        "ingredients": [],
    }
    client = make_client(TOKENS, structurer=FakeStructurer(raw=preparation(sheet)))

    response = post_text(client, {"text": "Caldo, cinco litros, unas 20 raciones"})

    assert response.status_code == 200
    assert response.json()["missing"] == []


def test_not_a_preparation_has_no_sheet(make_client: ClientFactory) -> None:
    fake = FakeStructurer(raw='{"is_preparation": false, "sheet": null}')
    client = make_client(TOKENS, structurer=fake)

    response = post_text(client, {"text": "hola, ¿qué tal el servicio?"})

    assert response.status_code == 200
    assert response.json() == {"is_preparation": False, "sheet": None, "missing": []}


def test_not_a_preparation_drops_any_sheet_sent_with_it(make_client: ClientFactory) -> None:
    raw = json.dumps({"is_preparation": False, "sheet": TUNA_SHEET})
    client = make_client(TOKENS, structurer=FakeStructurer(raw=raw))

    response = post_text(client, {"text": "hola"})

    assert response.status_code == 200
    assert response.json() == {"is_preparation": False, "sheet": None, "missing": []}


def test_the_structurer_gets_the_trimmed_text(make_client: ClientFactory) -> None:
    fake = FakeStructurer(raw='{"is_preparation": false, "sheet": null}')
    client = make_client(TOKENS, structurer=fake)

    post_text(client, {"text": "  \n Tartar de atún \t "})

    assert fake.calls == ["Tartar de atún"]


def test_text_of_exactly_the_cap_is_accepted(make_client: ClientFactory) -> None:
    fake = FakeStructurer(raw='{"is_preparation": false, "sheet": null}')
    client = make_client(TOKENS, structurer=fake)

    # Surrounding spaces do not count towards the cap.
    response = post_text(client, {"text": "  " + "a" * MAX_TEXT_CHARS + "  "})

    assert response.status_code == 200
    assert fake.calls == ["a" * MAX_TEXT_CHARS]


@pytest.mark.parametrize(
    "body",
    [
        {"text": ""},
        {"text": "   \n\t "},
        {"text": "a" * (MAX_TEXT_CHARS + 1)},
        {"text": 42},
        {"text": None},
        {},
        {"text": "hola", "extra": 1},
        "hola",
    ],
    ids=["empty", "blank", "over-cap", "number", "null", "no-text", "extra-field", "not-object"],
)
def test_invalid_text_is_rejected(make_client: ClientFactory, body: object) -> None:
    fake = FakeStructurer(raw='{"is_preparation": false, "sheet": null}')
    client = make_client(TOKENS, structurer=fake)

    response = post_text(client, body)

    assert response.status_code == 422
    assert fake.calls == []


def test_draft_requires_a_token(make_client: ClientFactory) -> None:
    fake = FakeStructurer()
    client = make_client(TOKENS, structurer=fake)

    response = client.post("/api/drafts", json={"text": "Tartar de atún"})

    assert response.status_code == 401
    assert fake.calls == []


def test_draft_without_openai_key_is_unavailable(make_client: ClientFactory) -> None:
    client = make_client(TOKENS)

    response = post_text(client, {"text": "Tartar de atún"})

    assert response.status_code == 503
    assert response.json() == {"detail": "Structuring is not configured"}


SECRET_MESSAGE = "Incorrect API key provided: sk-secret-123 (request req_abc)"


@pytest.mark.parametrize(
    ("error", "status", "detail"),
    [
        (StructuringError(SECRET_MESSAGE), 502, "Structuring failed"),
        (StructuringTimeout(SECRET_MESSAGE), 504, "Structuring timed out"),
    ],
    ids=["provider-error", "timeout"],
)
def test_structurer_failures_return_a_generic_error(
    make_client: ClientFactory, error: Exception, status: int, detail: str
) -> None:
    fake = FakeStructurer(error=error)
    client = make_client(TOKENS, structurer=fake)

    response = post_text(client, {"text": "Tartar de atún"})

    assert response.status_code == status
    assert response.json() == {"detail": detail}
    assert "sk-secret" not in response.text
    assert "req_abc" not in response.text
    assert len(fake.calls) == 1


def with_first_ingredient(**changes: object) -> dict:
    ingredients = [{**TUNA_SHEET["ingredients"][0], **changes}, *TUNA_SHEET["ingredients"][1:]]
    return {**TUNA_SHEET, "ingredients": ingredients}


def without(sheet: dict, key: str) -> dict:
    return {k: v for k, v in sheet.items() if k != key}


@pytest.mark.parametrize(
    "raw",
    [
        "Atún rojo, 1,5 kg {",
        '["Atún rojo"]',
        preparation(with_first_ingredient(unit="cucharada")),
        preparation(with_first_ingredient(quantity=-1.5)),
        preparation(without(TUNA_SHEET, "covers")),
        preparation(with_first_ingredient(estimated=None)),
        json.dumps({"sheet": TUNA_SHEET}),
        json.dumps({"is_preparation": True, "sheet": None}),
        json.dumps({"is_preparation": True}),
    ],
    ids=[
        "invalid-json",
        "not-an-object",
        "unknown-unit",
        "negative-quantity",
        "missing-sheet-field",
        "null-required-flag",
        "missing-is-preparation",
        "preparation-without-sheet",
        "preparation-with-no-sheet-key",
    ],
)
def test_invalid_model_output_returns_a_generic_error(
    make_client: ClientFactory, raw: str
) -> None:
    client = make_client(TOKENS, structurer=FakeStructurer(raw=raw))

    response = post_text(client, {"text": "Tartar de atún"})

    assert response.status_code == 502
    assert response.json() == {"detail": "Structuring failed"}
    # Neither the model output nor the validation error reaches the client.
    assert "Atún" not in response.text
    assert "cucharada" not in response.text


# The keywords the provider's strict mode accepts that we keep; everything else is dropped.
STRICT_KEYWORDS = {
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "enum",
    "anyOf",
    "$ref",
    "$defs",
}


def schema_nodes(node: object) -> Iterator[dict[str, Any]]:
    """Every schema in the tree, skipping the name maps of `properties` and `$defs`."""
    if not isinstance(node, dict):
        return
    yield node
    for key, value in node.items():
        if key in ("properties", "$defs"):
            for child in value.values():
                yield from schema_nodes(child)
        elif key == "items":
            yield from schema_nodes(value)
        elif key == "anyOf":
            for child in value:
                yield from schema_nodes(child)


def test_strict_schema_keeps_only_accepted_keywords() -> None:
    nodes = list(schema_nodes(strict_schema()))

    assert len(nodes) > 10
    for node in nodes:
        assert set(node) <= STRICT_KEYWORDS, node


def test_strict_schema_closes_every_object_and_requires_every_property() -> None:
    objects = [node for node in schema_nodes(strict_schema()) if node.get("type") == "object"]

    # The wrapper, Sheet, Yield, Covers and Ingredient.
    assert len(objects) == 5
    for node in objects:
        assert node["additionalProperties"] is False
        assert node["required"] == list(node["properties"])


def test_strict_schema_describes_the_model_output() -> None:
    schema = strict_schema()
    defs = schema["$defs"]
    unit = {"anyOf": [{"type": "string", "enum": ["g", "kg", "ml", "l", "ud"]}, {"type": "null"}]}
    quantity = {"anyOf": [{"type": "number"}, {"type": "null"}]}

    assert schema["properties"] == {
        "is_preparation": {"type": "boolean"},
        "sheet": {"anyOf": [{"$ref": "#/$defs/Sheet"}, {"type": "null"}]},
    }
    # The JSON name `yield`, not the Python field `yield_`.
    assert list(defs["Sheet"]["properties"]) == ["name", "yield", "covers", "ingredients"]
    assert defs["Sheet"]["properties"]["ingredients"] == {
        "type": "array",
        "items": {"$ref": "#/$defs/Ingredient"},
    }
    assert defs["Ingredient"]["properties"]["unit"] == unit
    assert defs["Ingredient"]["properties"]["quantity"] == quantity
    assert defs["Yield"]["properties"]["unit"] == unit
    assert defs["Covers"]["properties"]["value"] == {
        "anyOf": [{"type": "integer"}, {"type": "null"}]
    }


class _WithDefault(BaseModel):
    note: str = "none"
    count: int | None = None


def test_strict_schema_requires_fields_with_defaults_and_closes_open_models() -> None:
    # Strict mode has no optional fields: a field with a default must be sent too
    # (null where allowed). The model has no extra="forbid", yet the schema is closed.
    schema = strict_schema(_WithDefault)

    assert schema == {
        "type": "object",
        "properties": {
            "note": {"type": "string"},
            "count": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        },
        "required": ["note", "count"],
        "additionalProperties": False,
    }

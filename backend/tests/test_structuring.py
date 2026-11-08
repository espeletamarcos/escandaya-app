import json

import httpx
import pytest
from conftest import ClientFactory, FakeStructurer, make_settings
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.settings import Settings
from backend.structuring import (
    MAX_TEXT_CHARS,
    OpenAIStructurer,
    Structurer,
    StructuringError,
    StructuringResult,
    StructuringTimeout,
    get_structurer,
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

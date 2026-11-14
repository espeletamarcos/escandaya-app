import copy
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from conftest import ClientFactory
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend import preparations
from backend.db import Preparation
from backend.structuring import MAX_TEXT_CHARS

TOKENS = ("chef-token",)
AUTH = {"Authorization": "Bearer chef-token"}
CONFIRM_ID = "3f2b8c1e-5d4a-4c6b-9e7f-1a2b3c4d5e6f"
TRANSCRIPT = "Hago dos kilos de tartar de atún rojo para unas cuarenta raciones"


def make_sheet() -> dict[str, Any]:
    return {
        "name": "Tartar de atún",
        "yield": {"quantity": 2.0, "unit": "kg", "estimated": False},
        "covers": {"value": 40, "estimated": True},
        "ingredients": [
            {"name": "Atún rojo", "quantity": 1.8, "unit": "kg", "estimated": False},
            {"name": "Sal", "quantity": None, "unit": None, "estimated": False},
            {"name": "Aceite de oliva", "quantity": 100.0, "unit": "ml", "estimated": True},
        ],
    }


def make_body(**changes: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "confirm_id": CONFIRM_ID,
        "transcript": TRANSCRIPT,
        "sheet": make_sheet(),
    }
    body.update(changes)
    return body


def confirm(client: TestClient, body: dict[str, Any]) -> Response:
    return client.post("/api/preparations", json=body, headers=AUTH)


def count_saved(client: TestClient) -> int:
    with Session(client.app.state.engine) as session:
        return session.scalar(select(func.count()).select_from(Preparation)) or 0


@pytest.fixture
def client(make_client: ClientFactory) -> TestClient:
    return make_client(TOKENS)


# --- Saving -----------------------------------------------------------------------


def test_confirm_saves_the_sheet_and_returns_it(client: TestClient) -> None:
    before = datetime.now(UTC)

    response = confirm(client, make_body())

    assert response.status_code == 201
    saved = response.json()
    assert isinstance(saved["id"], int)
    assert saved["sheet"] == make_sheet()
    assert saved["missing"] == ["ingredients.1.quantity", "ingredients.1.unit"]
    confirmed_at = datetime.fromisoformat(saved["confirmed_at"])
    assert confirmed_at.utcoffset() == timedelta(0)
    assert before - timedelta(seconds=1) <= confirmed_at <= datetime.now(UTC)
    assert count_saved(client) == 1


def test_confirm_stores_every_field_with_ingredients_in_order(client: TestClient) -> None:
    saved_id = confirm(client, make_body(transcript=f"  {TRANSCRIPT}  ")).json()["id"]

    with Session(client.app.state.engine) as session:
        row = session.get_one(Preparation, saved_id)
        assert row.confirm_id == CONFIRM_ID
        assert row.name == "Tartar de atún"
        assert (row.yield_quantity, row.yield_unit, row.yield_estimated) == (2.0, "kg", False)
        assert (row.covers, row.covers_estimated) == (40, True)
        assert row.transcript == TRANSCRIPT
        assert [
            (item.position, item.name, item.quantity, item.unit, item.estimated)
            for item in row.ingredients
        ] == [
            (0, "Atún rojo", 1.8, "kg", False),
            (1, "Sal", None, None, False),
            (2, "Aceite de oliva", 100.0, "ml", True),
        ]


def test_a_sheet_with_missing_data_can_be_confirmed(client: TestClient) -> None:
    sheet = make_sheet()
    sheet["yield"] = {"quantity": None, "unit": None, "estimated": False}
    sheet["covers"] = {"value": None, "estimated": False}

    response = confirm(client, make_body(sheet=sheet))

    assert response.status_code == 201
    assert response.json()["missing"] == [
        "yield.quantity",
        "yield.unit",
        "covers",
        "ingredients.1.quantity",
        "ingredients.1.unit",
    ]


def test_a_sheet_without_ingredients_can_be_confirmed(client: TestClient) -> None:
    sheet = make_sheet()
    sheet["ingredients"] = []

    response = confirm(client, make_body(sheet=sheet))

    assert response.status_code == 201
    assert response.json()["sheet"]["ingredients"] == []


def test_whole_numbers_are_accepted_as_quantities(client: TestClient) -> None:
    # The phone sends 2, not 2.0, when the chef types a whole number.
    sheet = make_sheet()
    sheet["yield"]["quantity"] = 2
    sheet["ingredients"][0]["quantity"] = 1

    response = confirm(client, make_body(sheet=sheet))

    assert response.status_code == 201
    assert response.json()["sheet"]["yield"]["quantity"] == 2
    assert response.json()["sheet"]["ingredients"][0]["quantity"] == 1


def test_names_are_trimmed(client: TestClient) -> None:
    sheet = make_sheet()
    sheet["name"] = "  Tartar de atún  "
    sheet["ingredients"][0]["name"] = " Atún rojo "

    saved = confirm(client, make_body(sheet=sheet)).json()

    assert saved["sheet"]["name"] == "Tartar de atún"
    assert saved["sheet"]["ingredients"][0]["name"] == "Atún rojo"


# --- Missing data comes from the backend --------------------------------------------


def test_missing_data_sent_by_the_client_is_rejected(client: TestClient) -> None:
    response = confirm(client, make_body(missing=[]))

    assert response.status_code == 422
    assert count_saved(client) == 0


# --- Invalid sheets ---------------------------------------------------------------


def _set(path: list[str | int], value: Any) -> dict[str, Any]:
    sheet = make_sheet()
    target: Any = sheet
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    return sheet


def _without(path: list[str | int]) -> dict[str, Any]:
    sheet = make_sheet()
    target: Any = sheet
    for key in path[:-1]:
        target = target[key]
    del target[path[-1]]
    return sheet


INVALID_SHEETS = {
    "unknown unit": _set(["ingredients", 0, "unit"], "puñado"),
    "negative quantity": _set(["ingredients", 0, "quantity"], -1),
    "zero quantity": _set(["yield", "quantity"], 0),
    "quantity too large": _set(["ingredients", 0, "quantity"], 100_001),
    "quantity as text": _set(["ingredients", 0, "quantity"], "300"),
    "covers as text": _set(["covers", "value"], "40"),
    "covers with decimals": _set(["covers", "value"], 40.5),
    "zero covers": _set(["covers", "value"], 0),
    "empty name": _set(["name"], "   "),
    "empty ingredient name": _set(["ingredients", 0, "name"], ""),
    "name too long": _set(["name"], "a" * 121),
    "estimated as text": _set(["ingredients", 0, "estimated"], "true"),
    "extra field in an ingredient": _set(["ingredients", 0, "price"], 38),
    "missing field": _without(["covers"]),
    "missing ingredient field": _without(["ingredients", 0, "estimated"]),
    "too many ingredients": _set(
        ["ingredients"],
        [{"name": f"Item {i}", "quantity": 1, "unit": "g", "estimated": False} for i in range(101)],
    ),
}


@pytest.mark.parametrize("sheet", INVALID_SHEETS.values(), ids=INVALID_SHEETS.keys())
def test_an_invalid_sheet_is_rejected_and_not_saved(
    client: TestClient, sheet: dict[str, Any]
) -> None:
    response = confirm(client, make_body(sheet=sheet))

    assert response.status_code == 422
    assert count_saved(client) == 0


def test_a_hundred_ingredients_are_accepted(client: TestClient) -> None:
    sheet = make_sheet()
    sheet["ingredients"] = [
        {"name": f"Item {i}", "quantity": 1, "unit": "g", "estimated": False} for i in range(100)
    ]

    assert confirm(client, make_body(sheet=sheet)).status_code == 201


@pytest.mark.parametrize(
    "transcript",
    ["", "   ", "a" * (MAX_TEXT_CHARS + 1), None, 42],
    ids=["empty", "blank", "over the cap", "null", "number"],
)
def test_an_invalid_transcript_is_rejected(client: TestClient, transcript: Any) -> None:
    response = confirm(client, make_body(transcript=transcript))

    assert response.status_code == 422
    assert count_saved(client) == 0


def test_a_transcript_at_the_cap_is_accepted(client: TestClient) -> None:
    response = confirm(client, make_body(transcript="a" * MAX_TEXT_CHARS))

    assert response.status_code == 201


@pytest.mark.parametrize("confirm_id", ["not-a-uuid", "", None], ids=["text", "empty", "null"])
def test_an_invalid_confirm_id_is_rejected(client: TestClient, confirm_id: Any) -> None:
    response = confirm(client, make_body(confirm_id=confirm_id))

    assert response.status_code == 422
    assert count_saved(client) == 0


@pytest.mark.parametrize("field", ["confirm_id", "transcript", "sheet"])
def test_a_body_without_a_field_is_rejected(client: TestClient, field: str) -> None:
    body = make_body()
    del body[field]

    assert confirm(client, body).status_code == 422


# --- The same sheet twice ---------------------------------------------------------


def test_the_same_confirm_id_twice_saves_one_copy(client: TestClient) -> None:
    first = confirm(client, make_body())
    second = confirm(client, make_body())

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json() == first.json()
    assert count_saved(client) == 1


def test_a_repeat_returns_the_saved_copy_not_the_new_content(client: TestClient) -> None:
    first = confirm(client, make_body())
    changed = copy.deepcopy(make_sheet())
    changed["name"] = "Otro nombre"

    second = confirm(client, make_body(sheet=changed))

    assert second.status_code == 200
    assert second.json()["sheet"]["name"] == "Tartar de atún"
    assert second.json()["id"] == first.json()["id"]


def test_the_confirm_id_is_compared_as_a_uuid(client: TestClient) -> None:
    first = confirm(client, make_body())
    second = confirm(client, make_body(confirm_id=CONFIRM_ID.upper()))

    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]


def test_different_confirm_ids_save_two_copies(client: TestClient) -> None:
    confirm(client, make_body())
    response = confirm(client, make_body(confirm_id="00000000-0000-4000-8000-000000000001"))

    assert response.status_code == 201
    assert count_saved(client) == 2


def test_a_repeat_arriving_at_the_same_moment_returns_the_saved_copy(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = confirm(client, make_body())
    # The second request looks before the first one has committed, finds nothing,
    # and then hits the unique constraint when it saves.
    real_find = preparations.find_by_confirm_id
    calls = {"count": 0}

    def find_late(session: Session, confirm_id: str) -> Preparation | None:
        calls["count"] += 1
        return None if calls["count"] == 1 else real_find(session, confirm_id)

    monkeypatch.setattr(preparations, "find_by_confirm_id", find_late)

    second = confirm(client, make_body())

    assert second.status_code == 200
    assert second.json() == first.json()
    assert count_saved(client) == 1


# --- Access -----------------------------------------------------------------------


def test_confirm_needs_a_token(client: TestClient) -> None:
    response = client.post("/api/preparations", json=make_body())

    assert response.status_code == 401
    assert count_saved(client) == 0

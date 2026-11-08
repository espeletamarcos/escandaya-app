import json
from typing import Any

import pytest
from pydantic import ValidationError

from backend.sheets import Sheet


def ingredient(**overrides: Any) -> dict[str, Any]:
    return {"name": "Tomate", "quantity": 2, "unit": "kg", "estimated": False, **overrides}


def sheet_data(**overrides: Any) -> dict[str, Any]:
    return {
        "name": "Salsa de tomate",
        "yield": {"quantity": 1.5, "unit": "l", "estimated": False},
        "covers": {"value": 10, "estimated": False},
        "ingredients": [ingredient()],
        **overrides,
    }


def parse(data: dict[str, Any]) -> Sheet:
    """Validate the way the endpoint will: from the JSON text."""
    return Sheet.model_validate_json(json.dumps(data))


def test_valid_sheet_is_parsed() -> None:
    sheet = parse(sheet_data())

    assert sheet.name == "Salsa de tomate"
    assert sheet.yield_.quantity == 1.5
    assert sheet.yield_.unit == "l"
    assert sheet.covers.value == 10
    assert sheet.ingredients[0].name == "Tomate"
    assert sheet.ingredients[0].quantity == 2
    assert sheet.ingredients[0].unit == "kg"


def test_sheet_is_dumped_with_the_yield_alias() -> None:
    dumped = parse(sheet_data()).model_dump(by_alias=True)

    assert "yield" in dumped
    assert "yield_" not in dumped


def test_unknown_values_can_be_null() -> None:
    sheet = parse(
        sheet_data(
            **{
                "yield": {"quantity": None, "unit": None, "estimated": False},
                "covers": {"value": None, "estimated": False},
                "ingredients": [ingredient(name="Sal", quantity=None, unit=None)],
            }
        )
    )

    assert sheet.yield_.quantity is None
    assert sheet.covers.value is None
    assert sheet.ingredients[0].unit is None


def test_a_sheet_may_have_no_ingredients() -> None:
    assert parse(sheet_data(ingredients=[])).ingredients == []


def test_names_are_trimmed() -> None:
    sheet = parse(sheet_data(name="  Salsa  ", ingredients=[ingredient(name=" Tomate ")]))

    assert sheet.name == "Salsa"
    assert sheet.ingredients[0].name == "Tomate"


@pytest.mark.parametrize("unit", ["g", "kg", "ml", "l", "ud"])
def test_every_listed_unit_is_accepted(unit: str) -> None:
    assert parse(sheet_data(ingredients=[ingredient(unit=unit)])).ingredients[0].unit == unit


@pytest.mark.parametrize(
    "data",
    [
        pytest.param(sheet_data(ingredients=[ingredient(unit="pizca")]), id="unknown unit"),
        pytest.param(sheet_data(ingredients=[ingredient(unit="KG")]), id="unit in capitals"),
        pytest.param(sheet_data(ingredients=[ingredient(quantity=-1)]), id="negative quantity"),
        pytest.param(sheet_data(ingredients=[ingredient(quantity=0)]), id="zero quantity"),
        pytest.param(sheet_data(ingredients=[ingredient(quantity=100001)]), id="huge quantity"),
        pytest.param(sheet_data(ingredients=[ingredient(quantity="300")]), id="quantity as text"),
        pytest.param(sheet_data(ingredients=[ingredient(quantity=True)]), id="quantity as bool"),
        pytest.param(sheet_data(ingredients=[ingredient(name="  ")]), id="blank ingredient name"),
        pytest.param(sheet_data(ingredients=[ingredient(name="x" * 121)]), id="long ingredient name"),
        pytest.param(sheet_data(ingredients=[ingredient(estimated="yes")]), id="estimated as text"),
        pytest.param(sheet_data(ingredients=[ingredient(colour="red")]), id="extra ingredient field"),
        pytest.param(sheet_data(ingredients=[ingredient()] * 101), id="too many ingredients"),
        pytest.param(sheet_data(name=""), id="empty name"),
        pytest.param(sheet_data(name="x" * 121), id="long name"),
        pytest.param(
            sheet_data(**{"yield": {"quantity": -2, "unit": "kg", "estimated": False}}),
            id="negative yield",
        ),
        pytest.param(
            sheet_data(**{"yield": {"quantity": 2, "unit": "taza", "estimated": False}}),
            id="unknown yield unit",
        ),
        pytest.param(sheet_data(covers={"value": 0, "estimated": False}), id="zero covers"),
        pytest.param(sheet_data(covers={"value": 10001, "estimated": False}), id="too many covers"),
        pytest.param(sheet_data(covers={"value": 2.5, "estimated": False}), id="fractional covers"),
        pytest.param(sheet_data(steps=["mix"]), id="extra sheet field"),
    ],
)
def test_invalid_sheets_are_rejected(data: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        parse(data)


def test_yield_under_its_python_name_is_rejected() -> None:
    data = sheet_data()
    data["yield_"] = data.pop("yield")

    with pytest.raises(ValidationError):
        parse(data)


@pytest.mark.parametrize("field", ["name", "yield", "covers", "ingredients"])
def test_missing_sheet_fields_are_rejected(field: str) -> None:
    data = sheet_data()
    del data[field]

    with pytest.raises(ValidationError):
        parse(data)


@pytest.mark.parametrize("field", ["name", "quantity", "unit", "estimated"])
def test_missing_ingredient_fields_are_rejected(field: str) -> None:
    item = ingredient()
    del item[field]

    with pytest.raises(ValidationError):
        parse(sheet_data(ingredients=[item]))

"""The recipe sheet: what a valid sheet is, independent of where it comes from.

Kept apart from the OpenAI code so that spec 05 can validate a confirmed sheet
with the same models.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Unit = Literal["g", "kg", "ml", "l", "ud"]

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Quantity = Annotated[float, Field(gt=0, le=100_000)]
CoversValue = Annotated[int, Field(ge=1, le=10_000)]


class _Model(BaseModel):
    # Strict: no "300" -> 300 or true -> 1 coercion. Unexpected fields are an error.
    model_config = ConfigDict(extra="forbid", strict=True)


class Ingredient(_Model):
    name: Name
    quantity: Quantity | None
    unit: Unit | None
    estimated: bool


class Yield(_Model):
    quantity: Quantity | None
    unit: Unit | None
    estimated: bool


class Covers(_Model):
    value: CoversValue | None
    estimated: bool


class Sheet(_Model):
    name: Name
    # `yield` is a Python keyword, so the field is `yield_` and the JSON key is `yield`.
    yield_: Yield = Field(alias="yield")
    covers: Covers
    ingredients: list[Ingredient] = Field(max_length=100)

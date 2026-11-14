"""Confirmed sheets: saving them (spec 05).

The sheet the phone sends is untrusted. It is validated with the same models as
the model's output (`sheets.py`), and its missing data is recomputed here: the
client never sends it.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.db import Preparation, PreparationIngredient, get_session
from backend.sheets import Sheet, missing_fields
from backend.structuring import MAX_TEXT_CHARS

router = APIRouter()


class ConfirmRequest(BaseModel):
    # Any other field, such as a `missing` list, is a 422: it is never read.
    model_config = ConfigDict(extra="forbid")

    # Made once per sheet on the phone. Sending the same sheet again returns the copy
    # already saved, so a double tap or a retry after a timeout saves it once.
    confirm_id: UUID
    transcript: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_TEXT_CHARS)
    ]
    sheet: Sheet


class SavedPreparation(BaseModel):
    id: int
    confirmed_at: datetime
    sheet: Sheet
    missing: list[str]


def find_by_confirm_id(session: Session, confirm_id: str) -> Preparation | None:
    return session.scalar(select(Preparation).where(Preparation.confirm_id == confirm_id))


def to_row(request: ConfirmRequest, confirmed_at: datetime) -> Preparation:
    sheet = request.sheet
    return Preparation(
        confirm_id=str(request.confirm_id),
        name=sheet.name,
        yield_quantity=sheet.yield_.quantity,
        yield_unit=sheet.yield_.unit,
        yield_estimated=sheet.yield_.estimated,
        covers=sheet.covers.value,
        covers_estimated=sheet.covers.estimated,
        transcript=request.transcript,
        confirmed_at=confirmed_at,
        ingredients=[
            PreparationIngredient(
                position=position,
                name=item.name,
                quantity=item.quantity,
                unit=item.unit,
                estimated=item.estimated,
            )
            for position, item in enumerate(sheet.ingredients)
        ],
    )


def to_sheet(row: Preparation) -> Sheet:
    return Sheet.model_validate(
        {
            "name": row.name,
            "yield": {
                "quantity": row.yield_quantity,
                "unit": row.yield_unit,
                "estimated": row.yield_estimated,
            },
            "covers": {"value": row.covers, "estimated": row.covers_estimated},
            "ingredients": [
                {
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "estimated": item.estimated,
                }
                for item in row.ingredients
            ],
        }
    )


def to_saved(row: Preparation) -> SavedPreparation:
    sheet = to_sheet(row)
    return SavedPreparation(
        id=row.id, confirmed_at=row.confirmed_at, sheet=sheet, missing=missing_fields(sheet)
    )


@router.post("/preparations", status_code=status.HTTP_201_CREATED)
def confirm_preparation(
    request: ConfirmRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
) -> SavedPreparation:
    """Save a confirmed sheet: 201 with the saved copy, or 200 if this confirm id
    was already saved."""
    confirm_id = str(request.confirm_id)
    existing = find_by_confirm_id(session, confirm_id)
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        return to_saved(existing)

    row = to_row(request, confirmed_at=datetime.now(UTC))
    session.add(row)
    try:
        session.commit()
    except IntegrityError:
        # Another request with the same confirm id saved it between our look and our save.
        session.rollback()
        existing = find_by_confirm_id(session, confirm_id)
        if existing is None:
            raise
        response.status_code = status.HTTP_200_OK
        return to_saved(existing)
    return to_saved(row)

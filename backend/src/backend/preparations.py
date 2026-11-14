"""Confirmed sheets: saving them, listing them and reading one back (spec 05).

The sheet the phone sends is untrusted. It is validated with the same models as
the model's output (`sheets.py`), and its missing data is recomputed here: the
client never sends it.
"""

import logging
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from backend.db import Preparation, PreparationIngredient, get_session
from backend.sheets import Sheet, missing_fields
from backend.structuring import MAX_TEXT_CHARS

router = APIRouter()
logger = logging.getLogger(__name__)

# SQLite stores integers in 8 bytes: a larger id cannot exist, and would raise.
MAX_ID = 2**63 - 1


def now() -> datetime:
    """The confirmation time. A function, so tests can set it."""
    return datetime.now(UTC)


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
    """One preparation in full. The transcript is kept but not sent: no screen shows it."""

    id: int
    confirmed_at: datetime
    sheet: Sheet
    missing: list[str]


class PreparationSummary(BaseModel):
    """One line of the list."""

    id: int
    name: str
    covers: int | None
    missing_count: int
    confirmed_at: datetime


@dataclass
class LogEntry:
    # Anything that escapes without setting a status reaches the client as a 500.
    status: int = 500


@contextmanager
def logged(action: str) -> Iterator[LogEntry]:
    """The only log line for a request: the action, the status and the duration.
    Never the transcript, the sheet or the confirm id (05-C7).

    A request rejected before the endpoint runs (422) gets no line here: uvicorn's
    access log has its path and status, and its body is never logged.
    """
    entry = LogEntry()
    started = time.perf_counter()
    try:
        yield entry
    except HTTPException as error:
        entry.status = error.status_code
        raise
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000)
        logger.info(
            "preparations action=%s status=%d duration_ms=%s", action, entry.status, duration_ms
        )


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


def save(session: Session, request: ConfirmRequest) -> tuple[SavedPreparation, bool]:
    """Save the sheet unless its confirm id is already saved. Returns the saved copy
    and whether it was created now."""
    confirm_id = str(request.confirm_id)
    existing = find_by_confirm_id(session, confirm_id)
    if existing is not None:
        return to_saved(existing), False

    row = to_row(request, confirmed_at=now())
    session.add(row)
    try:
        session.commit()
    except IntegrityError:
        # Another request with the same confirm id saved it between our look and our save.
        session.rollback()
        existing = find_by_confirm_id(session, confirm_id)
        if existing is None:
            raise
        return to_saved(existing), False
    return to_saved(row), True


@router.post("/preparations", status_code=status.HTTP_201_CREATED)
def confirm_preparation(
    request: ConfirmRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
) -> SavedPreparation:
    """Save a confirmed sheet: 201 with the saved copy, or 200 if this confirm id
    was already saved."""
    with logged("confirm") as entry:
        saved, created = save(session, request)
        entry.status = response.status_code = 201 if created else 200
        return saved


@router.get("/preparations")
def list_preparations(
    session: Annotated[Session, Depends(get_session)],
) -> list[PreparationSummary]:
    """Every saved preparation, newest first. Same-second confirms keep their order by id."""
    with logged("list") as entry:
        rows = session.scalars(
            select(Preparation)
            # The ingredients are needed to count the missing data: load them in one query.
            .options(selectinload(Preparation.ingredients))
            .order_by(Preparation.confirmed_at.desc(), Preparation.id.desc())
        ).all()
        summaries = [
            PreparationSummary(
                id=row.id,
                name=row.name,
                covers=row.covers,
                missing_count=len(missing_fields(to_sheet(row))),
                confirmed_at=row.confirmed_at,
            )
            for row in rows
        ]
        entry.status = 200
        return summaries


def parse_id(text: str) -> int | None:
    """A positive id written as plain digits, or None. Anything else is not found."""
    if not text.isascii() or not text.isdigit():
        return None
    number = int(text)
    return number if 1 <= number <= MAX_ID else None


@router.get("/preparations/{preparation_id}")
def get_preparation(
    preparation_id: str,
    session: Annotated[Session, Depends(get_session)],
) -> SavedPreparation:
    """One preparation in full, or 404. The id is read as text: with an `int` parameter,
    FastAPI would answer 422 to a malformed id instead of 404."""
    with logged("detail") as entry:
        number = parse_id(preparation_id)
        row = None if number is None else session.get(Preparation, number)
        if row is None:
            raise HTTPException(status_code=404, detail="Preparation not found")
        saved = to_saved(row)
        entry.status = 200
        return saved

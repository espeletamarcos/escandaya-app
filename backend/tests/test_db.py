from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.db import (
    Base,
    Preparation,
    PreparationIngredient,
    get_session,
    make_engine,
)

TRANSCRIPT = "Hago dos kilos de tartar de atún rojo para cuarenta raciones"


@pytest.fixture
def engine(tmp_path: Path) -> Engine:
    # Until the migrations exist (next task), the tables come straight from the models.
    engine = make_engine(tmp_path / "test.db")
    Base.metadata.create_all(engine)
    return engine


def make_preparation(confirm_id: str = "id-1", **changes: object) -> Preparation:
    fields: dict[str, object] = {
        "confirm_id": confirm_id,
        "name": "Tartar de atún",
        "yield_quantity": 2.0,
        "yield_unit": "kg",
        "yield_estimated": False,
        "covers": 40,
        "covers_estimated": True,
        "transcript": TRANSCRIPT,
        "confirmed_at": datetime(2026, 11, 14, 12, 30, tzinfo=UTC),
    }
    fields.update(changes)
    return Preparation(**fields)


def test_make_engine_creates_the_folder(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "folder" / "app.db"

    engine = make_engine(path)
    with engine.connect() as connection:
        connection.execute(text("select 1"))

    assert path.is_file()


def test_foreign_keys_are_enforced(engine: Engine) -> None:
    orphan = PreparationIngredient(
        preparation_id=999, position=0, name="Atún", quantity=1.0, unit="kg", estimated=False
    )
    with Session(engine) as session:
        session.add(orphan)
        with pytest.raises(IntegrityError):
            session.commit()


def test_errors_do_not_quote_the_saved_data(engine: Engine) -> None:
    with Session(engine) as session:
        session.add(make_preparation("same-id"))
        session.commit()
    with Session(engine) as session:
        session.add(make_preparation("same-id"))
        with pytest.raises(IntegrityError) as error:
            session.commit()

    assert "UNIQUE" in str(error.value)
    assert TRANSCRIPT not in str(error.value)
    assert "Tartar" not in str(error.value)


def test_a_preparation_is_saved_with_its_ingredients_in_order(engine: Engine) -> None:
    preparation = make_preparation(
        ingredients=[
            PreparationIngredient(
                position=0, name="Atún rojo", quantity=1.8, unit="kg", estimated=False
            ),
            PreparationIngredient(position=1, name="Sal", quantity=None, unit=None, estimated=False),
            PreparationIngredient(
                position=2, name="Aceite", quantity=100.0, unit="ml", estimated=True
            ),
        ]
    )
    with Session(engine) as session:
        session.add(preparation)
        session.commit()
        saved_id = preparation.id

    with Session(engine) as session:
        saved = session.get_one(Preparation, saved_id)
        assert saved.name == "Tartar de atún"
        assert (saved.yield_quantity, saved.yield_unit, saved.yield_estimated) == (2.0, "kg", False)
        assert (saved.covers, saved.covers_estimated) == (40, True)
        assert saved.transcript == TRANSCRIPT
        assert [(item.name, item.quantity, item.unit, item.estimated) for item in saved.ingredients] == [
            ("Atún rojo", 1.8, "kg", False),
            ("Sal", None, None, False),
            ("Aceite", 100.0, "ml", True),
        ]


def test_ingredients_come_back_by_position_not_by_insertion(engine: Engine) -> None:
    preparation = make_preparation(
        ingredients=[
            PreparationIngredient(position=1, name="Second", quantity=None, unit=None, estimated=False),
            PreparationIngredient(position=0, name="First", quantity=None, unit=None, estimated=False),
        ]
    )
    with Session(engine) as session:
        session.add(preparation)
        session.commit()
        saved_id = preparation.id

    with Session(engine) as session:
        saved = session.get_one(Preparation, saved_id)
        assert [item.name for item in saved.ingredients] == ["First", "Second"]


def test_a_preparation_without_yield_or_covers_is_saved(engine: Engine) -> None:
    with Session(engine) as session:
        preparation = make_preparation(yield_quantity=None, yield_unit=None, covers=None)
        session.add(preparation)
        session.commit()
        saved_id = preparation.id

    with Session(engine) as session:
        saved = session.get_one(Preparation, saved_id)
        assert (saved.yield_quantity, saved.yield_unit, saved.covers) == (None, None, None)
        assert saved.ingredients == []


def test_confirmed_at_is_stored_and_read_back_as_utc(engine: Engine) -> None:
    madrid = timezone(timedelta(hours=1))
    with Session(engine) as session:
        preparation = make_preparation(confirmed_at=datetime(2026, 11, 14, 13, 30, tzinfo=madrid))
        session.add(preparation)
        session.commit()
        saved_id = preparation.id

    with Session(engine) as session:
        saved = session.get_one(Preparation, saved_id)
        assert saved.confirmed_at == datetime(2026, 11, 14, 12, 30, tzinfo=UTC)
        assert saved.confirmed_at.tzinfo == UTC


def test_a_time_without_a_time_zone_is_refused(engine: Engine) -> None:
    with Session(engine) as session:
        session.add(make_preparation(confirmed_at=datetime(2026, 11, 14, 12, 30)))
        with pytest.raises(Exception, match="time zone"):
            session.commit()


def test_get_session_uses_the_engine_of_the_app(engine: Engine) -> None:
    with Session(engine) as session:
        session.add(make_preparation())
        session.commit()

    app = FastAPI()
    app.state.engine = engine

    @app.get("/count")
    def count(session: Annotated[Session, Depends(get_session)]) -> int:
        return len(session.scalars(select(Preparation)).all())

    assert TestClient(app).get("/count").json() == 1

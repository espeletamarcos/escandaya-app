from datetime import UTC, datetime
from pathlib import Path

from conftest import ClientFactory
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from backend.db import Preparation
from backend.main import create_app


def save_preparation(client: TestClient, name: str) -> None:
    with Session(client.app.state.engine) as session:
        session.add(
            Preparation(
                confirm_id=f"id-{name}",
                name=name,
                yield_quantity=None,
                yield_unit=None,
                yield_estimated=False,
                covers=None,
                covers_estimated=False,
                transcript="texto",
                confirmed_at=datetime(2026, 11, 14, 12, 0, tzinfo=UTC),
            )
        )
        session.commit()


def saved_names(client: TestClient) -> list[str]:
    with Session(client.app.state.engine) as session:
        return list(session.scalars(select(Preparation.name)).all())


def test_building_the_app_does_not_open_the_database(tmp_path: Path) -> None:
    path = tmp_path / "data" / "app.db"

    create_app(static_dir=None, database_path=path)

    assert not path.parent.exists()


def test_starting_the_app_creates_and_migrates_the_database(tmp_path: Path) -> None:
    path = tmp_path / "data" / "app.db"

    with TestClient(create_app(static_dir=None, database_path=path)) as client:
        tables = set(inspect(client.app.state.engine).get_table_names())

    assert path.is_file()
    assert {"preparations", "preparation_ingredients"} <= tables


def test_starting_the_app_twice_keeps_the_data(tmp_path: Path) -> None:
    path = tmp_path / "app.db"
    with TestClient(create_app(static_dir=None, database_path=path)) as first:
        save_preparation(first, "Tartar de atún")

    # A second start on the same file, as after a deploy or an idle stop.
    with TestClient(create_app(static_dir=None, database_path=path)) as second:
        assert saved_names(second) == ["Tartar de atún"]


def test_each_client_from_make_client_has_its_own_empty_database(make_client: ClientFactory) -> None:
    first = make_client()
    save_preparation(first, "Tartar de atún")
    second = make_client()

    assert saved_names(first) == ["Tartar de atún"]
    assert saved_names(second) == []

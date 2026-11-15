import sqlite3
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from backend.backup import BackupError, backup, main
from backend.db import Preparation, make_engine, migrate


def make_database(path: Path, name: str = "Tartar de atún") -> None:
    engine = make_engine(path)
    migrate(engine)
    with Session(engine) as session:
        session.add(
            Preparation(
                confirm_id="id-1",
                name=name,
                yield_quantity=None,
                yield_unit=None,
                yield_estimated=False,
                covers=40,
                covers_estimated=False,
                transcript="texto",
                confirmed_at=datetime(2026, 11, 14, 12, 0, tzinfo=UTC),
            )
        )
        session.commit()
    engine.dispose()


def names_in(path: Path) -> list[str]:
    with sqlite3.connect(path) as connection:
        return [row[0] for row in connection.execute("select name from preparations")]


def test_backup_copies_the_database(tmp_path: Path) -> None:
    source = tmp_path / "app.db"
    make_database(source)

    backup(source, tmp_path / "copy.db")

    assert names_in(tmp_path / "copy.db") == ["Tartar de atún"]


def test_the_copy_keeps_the_migration_version(tmp_path: Path) -> None:
    source = tmp_path / "app.db"
    make_database(source)

    backup(source, tmp_path / "copy.db")

    with sqlite3.connect(tmp_path / "copy.db") as connection:
        [(version,)] = connection.execute("select version_num from alembic_version").fetchall()
    assert version


def test_backup_replaces_an_older_copy(tmp_path: Path) -> None:
    source = tmp_path / "app.db"
    make_database(tmp_path / "copy.db", name="Old")
    make_database(source, name="New")

    backup(source, tmp_path / "copy.db")

    assert names_in(tmp_path / "copy.db") == ["New"]


def test_a_missing_source_is_an_error_and_creates_nothing(tmp_path: Path) -> None:
    source = tmp_path / "wrong.db"

    with pytest.raises(BackupError, match="No database"):
        backup(source, tmp_path / "copy.db")

    assert not source.exists()
    assert not (tmp_path / "copy.db").exists()


def test_the_copy_cannot_overwrite_the_database(tmp_path: Path) -> None:
    source = tmp_path / "app.db"
    make_database(source)

    with pytest.raises(BackupError, match="same file"):
        backup(source, tmp_path / "." / "app.db")

    assert names_in(source) == ["Tartar de atún"]


def test_the_source_is_not_changed(tmp_path: Path) -> None:
    source = tmp_path / "app.db"
    make_database(source)
    before = source.read_bytes()

    backup(source, tmp_path / "copy.db")

    assert source.read_bytes() == before


def test_main_copies_the_database_at_database_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "app.db"
    make_database(source)
    monkeypatch.setenv("DATABASE_PATH", str(source))

    code = main([str(tmp_path / "copy.db")])

    assert code == 0
    assert names_in(tmp_path / "copy.db") == ["Tartar de atún"]
    assert "copy.db" in capsys.readouterr().out


@pytest.mark.parametrize("args", [[], ["a.db", "b.db"]], ids=["no destination", "two"])
def test_main_needs_exactly_one_destination(
    args: list[str], capsys: pytest.CaptureFixture[str]
) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(args)

    assert exit_info.value.code != 0
    assert "usage" in capsys.readouterr().err.lower()


def test_main_reports_an_error_without_a_traceback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "wrong.db"))

    code = main([str(tmp_path / "copy.db")])

    assert code == 1
    assert "No database" in capsys.readouterr().err


def test_it_runs_as_a_module(tmp_path: Path) -> None:
    source = tmp_path / "app.db"
    make_database(source)

    result = subprocess.run(
        [sys.executable, "-m", "backend.backup", str(tmp_path / "copy.db")],
        env={"DATABASE_PATH": str(source)},
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert names_in(tmp_path / "copy.db") == ["Tartar de atún"]

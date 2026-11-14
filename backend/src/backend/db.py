"""The database: one SQLite file, its tables, and a session per request.

Saved sheets hold the chef's recipes and transcripts, so the engine never puts the
saved values in its error messages (05-C7).
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from sqlite3 import Connection as SQLiteConnection
from typing import Any

from alembic import command
from alembic.config import Config
from fastapi import Request
from sqlalchemy import (
    DateTime,
    Engine,
    ForeignKey,
    MetaData,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

from backend.sheets import Unit

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

# Fixed constraint names, so later migrations can find and change them on SQLite.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class UTCDateTime(TypeDecorator[datetime]):
    """A moment in time, stored as UTC and read back as UTC.

    SQLite has no time zones: it would keep the clock time and drop the offset.
    A time without a zone is refused, so a local time is never stored as UTC by mistake.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("A time without a time zone cannot be stored")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        return None if value is None else value.replace(tzinfo=UTC)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class Preparation(Base):
    """A confirmed sheet. Its missing data is not stored: it is recomputed on read."""

    __tablename__ = "preparations"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Made once per sheet on the phone, so sending the same sheet twice saves it once.
    confirm_id: Mapped[str] = mapped_column(String(36), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    yield_quantity: Mapped[float | None]
    yield_unit: Mapped[Unit | None] = mapped_column(String(2))
    yield_estimated: Mapped[bool]
    covers: Mapped[int | None]
    covers_estimated: Mapped[bool]
    transcript: Mapped[str] = mapped_column(Text)
    confirmed_at: Mapped[datetime] = mapped_column(UTCDateTime)

    ingredients: Mapped[list["PreparationIngredient"]] = relationship(
        back_populates="preparation",
        order_by="PreparationIngredient.position",
        cascade="all, delete-orphan",
    )


class PreparationIngredient(Base):
    """One ingredient line of a sheet. `position` keeps the order the chef sees."""

    __tablename__ = "preparation_ingredients"
    __table_args__ = (UniqueConstraint("preparation_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    preparation_id: Mapped[int] = mapped_column(
        ForeignKey("preparations.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int]
    name: Mapped[str] = mapped_column(String(120))
    quantity: Mapped[float | None]
    unit: Mapped[Unit | None] = mapped_column(String(2))
    estimated: Mapped[bool]

    preparation: Mapped[Preparation] = relationship(back_populates="ingredients")


def make_engine(path: Path) -> Engine:
    """An engine for the SQLite file at `path`, creating its folder if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{path}",
        # Error messages would otherwise quote the saved values: the sheet, the transcript.
        hide_parameters=True,
        # FastAPI runs sync endpoints in a thread pool; each request still has its own session.
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection: SQLiteConnection, _record: object) -> None:
        # SQLite ignores foreign keys unless each connection asks for them.
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def migrate(engine: Engine) -> None:
    """Bring the database up to date with the migrations. Does nothing if it already is."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, on the engine the app was built with."""
    with Session(request.app.state.engine, expire_on_commit=False) as session:
        yield session

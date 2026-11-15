"""Alembic's entry point, run for every migration command.

The app passes its own connection (`backend.db.migrate`). The `alembic` command
(for writing a new migration, see backend/alembic.ini) has none, so it opens the
database at DATABASE_PATH instead.
"""

from alembic import context
from sqlalchemy import Connection

from backend.db import Base, UTCDateTime, make_engine
from backend.settings import load_settings


def render_item(type_: str, obj: object, autogen_context: object) -> str | bool:
    """Write our column types as the plain types they store, so a migration file
    never imports app code that may change after it was written."""
    if type_ == "type" and isinstance(obj, UTCDateTime):
        return "sa.DateTime()"
    return False


def run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        # SQLite cannot change most column or constraint definitions in place: batch
        # mode copies the table instead, so later migrations can change existing tables.
        render_as_batch=True,
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is not None:
    run_migrations(connection)
else:
    engine = make_engine(load_settings().database_path)
    with engine.begin() as own_connection:
        run_migrations(own_connection)
    engine.dispose()

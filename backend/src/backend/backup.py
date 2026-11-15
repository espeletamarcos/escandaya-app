"""Copy the database to another file, safely, while the app is running (05-C8).

    python -m backend.backup <destination>

It copies the database at DATABASE_PATH with SQLite's online backup API, so the copy
is consistent even if a request writes during it. A plain `cp` could copy a file
caught halfway through a write. The Fly image has Python but no `sqlite3` tool,
which is why this lives here. The README has the steps to bring the copy home.
"""

import argparse
import sqlite3
import sys
from collections.abc import Sequence
from contextlib import closing
from pathlib import Path

from backend.settings import load_settings


class BackupError(Exception):
    """A copy that must not be made. The message is safe to show."""


def backup(source: Path, destination: Path) -> None:
    """Copy the database at `source` to `destination`, replacing any older copy there."""
    source = source.resolve()
    destination = destination.resolve()
    # sqlite3.connect would create an empty database at a wrong path; check first.
    if not source.is_file():
        raise BackupError(f"No database at {source}")
    if destination == source:
        raise BackupError("The copy cannot be the same file as the database")

    destination.parent.mkdir(parents=True, exist_ok=True)
    # Read-only, so the copy can never change the database.
    with (
        closing(sqlite3.connect(f"{source.as_uri()}?mode=ro", uri=True)) as database,
        closing(sqlite3.connect(destination)) as copy,
    ):
        database.backup(copy)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m backend.backup",
        description="Copy the database at DATABASE_PATH to DESTINATION.",
    )
    parser.add_argument("destination", type=Path, help="file to write the copy to")
    args = parser.parse_args(argv)

    source = load_settings().database_path
    try:
        backup(source, args.destination)
    except BackupError as error:
        print(f"Backup failed: {error}", file=sys.stderr)
        return 1
    print(f"Copied {source} to {args.destination}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

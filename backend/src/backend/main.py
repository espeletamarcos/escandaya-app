import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse

from backend import structuring, transcription
from backend.auth import require_token
from backend.db import make_engine, migrate
from backend.logs import configure_logging
from backend.settings import get_settings

configure_logging()

api = APIRouter(prefix="/api")
protected = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@protected.get("/session", status_code=204)
def session() -> None:
    """Lets the app check its stored token on open."""


protected.include_router(transcription.router)
protected.include_router(structuring.router)


def default_static_dir() -> Path | None:
    """Built frontend: FRONTEND_DIST if set, else frontend/dist in the repo."""
    configured = os.environ.get("FRONTEND_DIST")
    path = Path(configured) if configured else Path(__file__).parents[3] / "frontend" / "dist"
    return path if path.is_dir() else None


def create_app(static_dir: Path | None, database_path: Path) -> FastAPI:
    """The app, serving the built frontend from `static_dir` if given.

    The database at `database_path` is opened and migrated when the app starts, not
    when it is built, so importing the app never creates files.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = make_engine(database_path)
        # Before the first request is served, so no request sees an old schema.
        migrate(engine)
        app.state.engine = engine
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(lifespan=lifespan)
    app.include_router(api)
    app.include_router(protected)

    if static_dir is not None:
        root = static_dir.resolve()

        @app.get("/{path:path}", include_in_schema=False)
        def frontend(path: str) -> FileResponse:
            if path == "api" or path.startswith("api/"):
                raise HTTPException(status_code=404)
            candidate = (root / path).resolve()
            if candidate.is_file() and candidate.is_relative_to(root):
                return FileResponse(candidate)
            if Path(path).suffix:
                raise HTTPException(status_code=404)
            return FileResponse(root / "index.html")

    return app


app = create_app(default_static_dir(), get_settings().database_path)

import os
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse

from backend.auth import require_token

api = APIRouter(prefix="/api")
protected = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@protected.get("/session", status_code=204)
def session() -> None:
    """Lets the app check its stored token on open."""


def default_static_dir() -> Path | None:
    """Built frontend: FRONTEND_DIST if set, else frontend/dist in the repo."""
    configured = os.environ.get("FRONTEND_DIST")
    path = Path(configured) if configured else Path(__file__).parents[3] / "frontend" / "dist"
    return path if path.is_dir() else None


def create_app(static_dir: Path | None) -> FastAPI:
    app = FastAPI()
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


app = create_app(default_static_dir())

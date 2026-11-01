from collections.abc import Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import DEFAULT_TRANSCRIPTION_MODEL, Settings, get_settings

ClientFactory = Callable[..., TestClient]


def make_settings(tokens: tuple[str, ...] = ()) -> Settings:
    return Settings(
        access_tokens=tokens,
        openai_api_key=None,
        transcription_model=DEFAULT_TRANSCRIPTION_MODEL,
    )


@pytest.fixture
def make_client() -> ClientFactory:
    """Build a test client whose settings accept the given tokens."""

    def factory(tokens: tuple[str, ...] = (), static_dir: Path | None = None) -> TestClient:
        app = create_app(static_dir=static_dir)
        app.dependency_overrides[get_settings] = lambda: make_settings(tokens)
        return TestClient(app)

    return factory

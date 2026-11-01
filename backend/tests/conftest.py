from collections.abc import Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import DEFAULT_TRANSCRIPTION_MODEL, Settings, get_settings
from backend.transcription import get_transcriber

ClientFactory = Callable[..., TestClient]


def make_settings(
    tokens: tuple[str, ...] = (),
    openai_api_key: str | None = None,
) -> Settings:
    return Settings(
        access_tokens=tokens,
        openai_api_key=openai_api_key,
        transcription_model=DEFAULT_TRANSCRIPTION_MODEL,
    )


class FakeTranscriber:
    """Returns a fixed text, or raises `error`, and records every call."""

    def __init__(self, text: str = "", error: Exception | None = None) -> None:
        self.text = text
        self.error = error
        self.calls: list[tuple[bytes, str]] = []

    def transcribe(self, audio: bytes, content_type: str) -> str:
        self.calls.append((audio, content_type))
        if self.error is not None:
            raise self.error
        return self.text


@pytest.fixture
def make_client() -> ClientFactory:
    """Build a test client with the given tokens and, optionally, a fake transcriber."""

    def factory(
        tokens: tuple[str, ...] = (),
        static_dir: Path | None = None,
        transcriber: FakeTranscriber | None = None,
    ) -> TestClient:
        app = create_app(static_dir=static_dir)
        app.dependency_overrides[get_settings] = lambda: make_settings(tokens)
        if transcriber is not None:
            app.dependency_overrides[get_transcriber] = lambda: transcriber
        return TestClient(app)

    return factory

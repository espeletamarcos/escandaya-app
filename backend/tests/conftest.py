from collections.abc import Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import (
    DEFAULT_DATABASE_PATH,
    DEFAULT_STRUCTURING_MODEL,
    DEFAULT_TRANSCRIPTION_MODEL,
    Settings,
    get_settings,
)
from backend.structuring import StructuringResult, get_structurer
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
        structuring_model=DEFAULT_STRUCTURING_MODEL,
        # Not used until the database is wired into the app; then each test gets its own.
        database_path=DEFAULT_DATABASE_PATH,
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


class FakeStructurer:
    """Returns a fixed raw answer with fixed token counts, or raises `error`, and
    records every text it is given. `raw` is not validated, so it can be bad JSON."""

    def __init__(
        self,
        raw: str = "",
        error: Exception | None = None,
        input_tokens: int | None = 120,
        output_tokens: int | None = 80,
    ) -> None:
        self.raw = raw
        self.error = error
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.calls: list[str] = []

    def structure(self, text: str) -> StructuringResult:
        self.calls.append(text)
        if self.error is not None:
            raise self.error
        return StructuringResult(
            raw=self.raw,
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
        )


@pytest.fixture
def make_client() -> ClientFactory:
    """Build a test client with the given tokens and, optionally, fake providers."""

    def factory(
        tokens: tuple[str, ...] = (),
        static_dir: Path | None = None,
        transcriber: FakeTranscriber | None = None,
        structurer: FakeStructurer | None = None,
    ) -> TestClient:
        app = create_app(static_dir=static_dir)
        app.dependency_overrides[get_settings] = lambda: make_settings(tokens)
        if transcriber is not None:
            app.dependency_overrides[get_transcriber] = lambda: transcriber
        if structurer is not None:
            app.dependency_overrides[get_structurer] = lambda: structurer
        return TestClient(app)

    return factory

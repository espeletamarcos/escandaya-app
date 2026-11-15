from collections.abc import Callable, Iterator
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
        # Not read in tests: the app's database comes from `create_app` (see make_client).
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
def make_client(tmp_path_factory: pytest.TempPathFactory) -> Iterator[ClientFactory]:
    """Build a test client with the given tokens and, optionally, fake providers.

    Each client's app is started, as in production: it gets its own new database,
    created by the migrations, and is stopped when the test ends. The databases go
    in their own folder, never in a `tmp_path` a test may serve as the frontend.
    """
    databases = tmp_path_factory.mktemp("databases")
    started: list[TestClient] = []

    def factory(
        tokens: tuple[str, ...] = (),
        static_dir: Path | None = None,
        transcriber: FakeTranscriber | None = None,
        structurer: FakeStructurer | None = None,
    ) -> TestClient:
        database_path = databases / f"app-{len(started)}.db"
        app = create_app(static_dir=static_dir, database_path=database_path)
        app.dependency_overrides[get_settings] = lambda: make_settings(tokens)
        if transcriber is not None:
            app.dependency_overrides[get_transcriber] = lambda: transcriber
        if structurer is not None:
            app.dependency_overrides[get_structurer] = lambda: structurer
        client = TestClient(app)
        client.__enter__()  # Runs the startup: opens and migrates the database.
        started.append(client)
        return client

    yield factory
    for client in started:
        client.__exit__(None, None, None)

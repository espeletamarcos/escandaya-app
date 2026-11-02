from types import SimpleNamespace
from typing import Any

import httpx
import openai
import pytest
from conftest import ClientFactory, FakeTranscriber, make_settings
from fastapi import HTTPException

from backend.transcription import (
    MAX_AUDIO_BYTES,
    OpenAITranscriber,
    Transcriber,
    TranscriptionError,
    TranscriptionTimeout,
    get_transcriber,
)


def test_get_transcriber_is_unavailable_without_a_key() -> None:
    with pytest.raises(HTTPException) as error:
        get_transcriber(make_settings())

    assert error.value.status_code == 503


def test_get_transcriber_returns_openai_transcriber_with_a_key() -> None:
    transcriber = get_transcriber(make_settings(openai_api_key="sk-test"))

    assert isinstance(transcriber, OpenAITranscriber)


def test_get_transcriber_reuses_the_same_instance() -> None:
    settings = make_settings(openai_api_key="sk-test")

    assert get_transcriber(settings) is get_transcriber(settings)


def test_fake_transcriber_returns_text_and_records_calls() -> None:
    fake = FakeTranscriber(text="dos kilos de tartar")
    transcriber: Transcriber = fake

    assert transcriber.transcribe(b"audio", "audio/webm") == "dos kilos de tartar"
    assert fake.calls == [(b"audio", "audio/webm")]


def test_fake_transcriber_can_fail() -> None:
    fake = FakeTranscriber(error=RuntimeError("provider down"))

    with pytest.raises(RuntimeError):
        fake.transcribe(b"audio", "audio/mp4")
    assert fake.calls == [(b"audio", "audio/mp4")]


def test_make_client_installs_the_fake_transcriber(make_client: ClientFactory) -> None:
    fake = FakeTranscriber()
    client = make_client(transcriber=fake)

    override = client.app.dependency_overrides[get_transcriber]
    assert override() is fake


TOKENS = ("chef-token",)
AUTH = {"Authorization": "Bearer chef-token"}


def post_audio(client, body: bytes = b"audio-bytes", content_type: str | None = "audio/webm"):
    headers = dict(AUTH)
    if content_type is not None:
        headers["Content-Type"] = content_type
    return client.post("/api/transcriptions", content=body, headers=headers)


@pytest.mark.parametrize(
    ("sent_type", "expected_type"),
    [
        ("audio/webm", "audio/webm"),
        ("audio/webm;codecs=opus", "audio/webm"),
        ("audio/mp4", "audio/mp4"),
        ("Audio/MP4; codecs=mp4a.40.2", "audio/mp4"),
    ],
)
def test_transcribes_supported_audio(
    make_client: ClientFactory, sent_type: str, expected_type: str
) -> None:
    fake = FakeTranscriber(text="dos kilos de tartar")
    client = make_client(TOKENS, transcriber=fake)

    response = post_audio(client, b"audio-bytes", sent_type)

    assert response.status_code == 200
    assert response.json() == {"text": "dos kilos de tartar"}
    assert fake.calls == [(b"audio-bytes", expected_type)]


@pytest.mark.parametrize("sent_type", ["text/plain", "audio/wav", "application/octet-stream", None])
def test_unsupported_type_is_rejected(make_client: ClientFactory, sent_type: str | None) -> None:
    fake = FakeTranscriber()
    client = make_client(TOKENS, transcriber=fake)

    response = post_audio(client, content_type=sent_type)

    assert response.status_code == 415
    assert fake.calls == []


def test_transcription_requires_a_token(make_client: ClientFactory) -> None:
    fake = FakeTranscriber()
    client = make_client(TOKENS, transcriber=fake)

    response = client.post(
        "/api/transcriptions", content=b"audio", headers={"Content-Type": "audio/webm"}
    )

    assert response.status_code == 401
    assert fake.calls == []


def test_transcription_without_openai_key_is_unavailable(make_client: ClientFactory) -> None:
    client = make_client(TOKENS)

    response = post_audio(client)

    assert response.status_code == 503


def test_unsupported_type_wins_over_missing_key(make_client: ClientFactory) -> None:
    client = make_client(TOKENS)

    response = post_audio(client, content_type="text/plain")

    assert response.status_code == 415


def chunks(total: int, size: int = 64 * 1024):
    """Yield `total` bytes in chunks, so the client sends no Content-Length."""
    while total > 0:
        step = min(size, total)
        yield b"a" * step
        total -= step


def test_audio_at_the_limit_is_accepted(make_client: ClientFactory) -> None:
    fake = FakeTranscriber(text="ok")
    client = make_client(TOKENS, transcriber=fake)

    response = post_audio(client, b"a" * MAX_AUDIO_BYTES)

    assert response.status_code == 200
    assert len(fake.calls[0][0]) == MAX_AUDIO_BYTES


def test_audio_over_the_limit_is_rejected(make_client: ClientFactory) -> None:
    fake = FakeTranscriber()
    client = make_client(TOKENS, transcriber=fake)

    response = post_audio(client, b"a" * (MAX_AUDIO_BYTES + 1))

    assert response.status_code == 413
    assert fake.calls == []


def test_declared_length_over_the_limit_is_rejected_before_reading(
    make_client: ClientFactory,
) -> None:
    fake = FakeTranscriber()
    client = make_client(TOKENS, transcriber=fake)
    headers = {**AUTH, "Content-Type": "audio/webm", "Content-Length": str(MAX_AUDIO_BYTES + 1)}

    # The body is shorter than declared: only the header can trigger the 413.
    response = client.post("/api/transcriptions", content=b"short", headers=headers)

    assert response.status_code == 413
    assert fake.calls == []


def test_streamed_audio_over_the_limit_is_rejected(make_client: ClientFactory) -> None:
    fake = FakeTranscriber()
    client = make_client(TOKENS, transcriber=fake)
    headers = {**AUTH, "Content-Type": "audio/webm"}

    response = client.post(
        "/api/transcriptions", content=chunks(MAX_AUDIO_BYTES + 1), headers=headers
    )

    assert response.status_code == 413
    assert fake.calls == []


def test_streamed_audio_under_the_limit_is_accepted(make_client: ClientFactory) -> None:
    fake = FakeTranscriber(text="ok")
    client = make_client(TOKENS, transcriber=fake)
    headers = {**AUTH, "Content-Type": "audio/mp4"}

    response = client.post("/api/transcriptions", content=chunks(200_000), headers=headers)

    assert response.status_code == 200
    assert len(fake.calls[0][0]) == 200_000


SECRET_MESSAGE = "Incorrect API key provided: sk-secret-123 (request req_abc)"


@pytest.mark.parametrize(
    ("error", "status", "detail"),
    [
        (TranscriptionError(SECRET_MESSAGE), 502, "Transcription failed"),
        (TranscriptionTimeout(SECRET_MESSAGE), 504, "Transcription timed out"),
    ],
)
def test_transcriber_failures_return_a_generic_error(
    make_client: ClientFactory, error: Exception, status: int, detail: str
) -> None:
    fake = FakeTranscriber(error=error)
    client = make_client(TOKENS, transcriber=fake)

    response = post_audio(client)

    assert response.status_code == status
    assert response.json() == {"detail": detail}
    assert "sk-secret" not in response.text
    assert "req_abc" not in response.text
    assert len(fake.calls) == 1


def test_timeout_is_a_kind_of_transcription_error() -> None:
    # Implementations may raise either; callers catching TranscriptionError see both.
    assert issubclass(TranscriptionTimeout, TranscriptionError)


# --- OpenAITranscriber (the SDK call is stubbed; tests never reach OpenAI) ---

OPENAI_REQUEST = httpx.Request("POST", "https://api.openai.com/v1/audio/transcriptions")


def stub_create(
    monkeypatch: pytest.MonkeyPatch,
    transcriber: OpenAITranscriber,
    text: str = "",
    error: Exception | None = None,
) -> list[dict[str, Any]]:
    """Replace the SDK call with a stub that records its arguments."""
    calls: list[dict[str, Any]] = []

    def create(**kwargs: Any) -> SimpleNamespace:
        calls.append(kwargs)
        if error is not None:
            raise error
        return SimpleNamespace(text=text)

    monkeypatch.setattr(transcriber.client.audio.transcriptions, "create", create)
    return calls


def test_openai_client_has_a_60s_timeout_and_no_retries() -> None:
    transcriber = OpenAITranscriber(api_key="sk-test", model="some-model")

    assert transcriber.client.timeout == 60.0
    assert transcriber.client.max_retries == 0


@pytest.mark.parametrize(
    ("content_type", "filename"),
    [("audio/webm", "voice-note.webm"), ("audio/mp4", "voice-note.mp4")],
)
def test_openai_transcriber_sends_audio_in_spanish_with_matching_extension(
    monkeypatch: pytest.MonkeyPatch, content_type: str, filename: str
) -> None:
    transcriber = OpenAITranscriber(api_key="sk-test", model="some-model")
    calls = stub_create(monkeypatch, transcriber, text="dos kilos de tartar")

    text = transcriber.transcribe(b"audio-bytes", content_type)

    assert text == "dos kilos de tartar"
    assert calls == [
        {
            "model": "some-model",
            "file": (filename, b"audio-bytes", content_type),
            "language": "es",
        }
    ]


def test_openai_timeout_becomes_transcription_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    transcriber = OpenAITranscriber(api_key="sk-test", model="some-model")
    stub_create(monkeypatch, transcriber, error=openai.APITimeoutError(request=OPENAI_REQUEST))

    with pytest.raises(TranscriptionTimeout):
        transcriber.transcribe(b"audio", "audio/webm")


@pytest.mark.parametrize(
    "error",
    [
        openai.APIConnectionError(request=OPENAI_REQUEST),
        openai.APIStatusError(
            SECRET_MESSAGE,
            response=httpx.Response(401, request=OPENAI_REQUEST),
            body=None,
        ),
    ],
)
def test_openai_failures_become_transcription_error(
    monkeypatch: pytest.MonkeyPatch, error: Exception
) -> None:
    transcriber = OpenAITranscriber(api_key="sk-test", model="some-model")
    stub_create(monkeypatch, transcriber, error=error)

    with pytest.raises(TranscriptionError) as raised:
        transcriber.transcribe(b"audio", "audio/webm")

    assert not isinstance(raised.value, TranscriptionTimeout)
    assert "sk-secret" not in str(raised.value)
    assert raised.value.__cause__ is None

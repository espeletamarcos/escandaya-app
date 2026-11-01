import pytest
from conftest import ClientFactory, FakeTranscriber, make_settings
from fastapi import HTTPException

from backend.transcription import MAX_AUDIO_BYTES, Transcriber, get_transcriber


def test_get_transcriber_is_unavailable_without_a_key() -> None:
    with pytest.raises(HTTPException) as error:
        get_transcriber(make_settings())

    assert error.value.status_code == 503


def test_get_transcriber_is_unavailable_until_openai_is_wired() -> None:
    # Task 8 replaces this with an OpenAITranscriber when a key is set.
    with pytest.raises(HTTPException) as error:
        get_transcriber(make_settings(openai_api_key="sk-test"))

    assert error.value.status_code == 503


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

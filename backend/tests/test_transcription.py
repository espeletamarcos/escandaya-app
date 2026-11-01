import pytest
from conftest import ClientFactory, FakeTranscriber, make_settings
from fastapi import HTTPException

from backend.transcription import Transcriber, get_transcriber


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

import pytest
from conftest import ClientFactory, FakeStructurer, make_settings
from fastapi import HTTPException

from backend.settings import Settings
from backend.structuring import (
    OpenAIStructurer,
    Structurer,
    StructuringError,
    StructuringResult,
    StructuringTimeout,
    get_structurer,
)


def test_get_structurer_is_unavailable_without_a_key() -> None:
    with pytest.raises(HTTPException) as error:
        get_structurer(make_settings())

    assert error.value.status_code == 503
    assert error.value.detail == "Structuring is not configured"


def test_get_structurer_uses_the_key_and_the_configured_model() -> None:
    settings = Settings(
        access_tokens=(),
        openai_api_key="sk-test",
        transcription_model="any-transcription-model",
        structuring_model="some-structuring-model",
    )

    structurer = get_structurer(settings)

    assert isinstance(structurer, OpenAIStructurer)
    assert structurer.api_key == "sk-test"
    assert structurer.model == "some-structuring-model"


def test_get_structurer_reuses_the_same_instance() -> None:
    settings = make_settings(openai_api_key="sk-test")

    assert get_structurer(settings) is get_structurer(settings)


def test_a_timeout_is_a_structuring_error() -> None:
    # The endpoint catches the timeout first, then every other StructuringError.
    assert issubclass(StructuringTimeout, StructuringError)


def test_fake_structurer_returns_raw_answer_and_records_calls() -> None:
    fake = FakeStructurer(raw='{"is_preparation": false, "sheet": null}')
    structurer: Structurer = fake

    result = structurer.structure("hola, qué tal")

    assert result == StructuringResult(
        raw='{"is_preparation": false, "sheet": null}', input_tokens=120, output_tokens=80
    )
    assert fake.calls == ["hola, qué tal"]


def test_fake_structurer_can_return_bad_json() -> None:
    assert FakeStructurer(raw="not json {").structure("texto").raw == "not json {"


def test_fake_structurer_can_fail() -> None:
    fake = FakeStructurer(error=StructuringTimeout())

    with pytest.raises(StructuringTimeout):
        fake.structure("texto")
    assert fake.calls == ["texto"]


def test_make_client_installs_the_fake_structurer(make_client: ClientFactory) -> None:
    fake = FakeStructurer()
    client = make_client(structurer=fake)

    override = client.app.dependency_overrides[get_structurer]
    assert override() is fake

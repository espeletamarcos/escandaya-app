from pathlib import Path

from backend.settings import (
    DEFAULT_DATABASE_PATH,
    DEFAULT_STRUCTURING_MODEL,
    DEFAULT_TRANSCRIPTION_MODEL,
    load_settings,
)


def test_empty_environment_uses_safe_defaults() -> None:
    settings = load_settings({})

    assert settings.access_tokens == ()
    assert settings.openai_api_key is None
    assert settings.transcription_model == DEFAULT_TRANSCRIPTION_MODEL == "gpt-4o-mini-transcribe"
    assert settings.structuring_model == DEFAULT_STRUCTURING_MODEL == "gpt-5-mini"
    assert settings.database_path == DEFAULT_DATABASE_PATH


def test_access_tokens_are_split_and_trimmed() -> None:
    settings = load_settings({"ACCESS_TOKENS": " chef-token , owner-token "})

    assert settings.access_tokens == ("chef-token", "owner-token")


def test_empty_access_token_entries_are_dropped() -> None:
    settings = load_settings({"ACCESS_TOKENS": "chef-token,, ,owner-token,"})

    assert settings.access_tokens == ("chef-token", "owner-token")


def test_blank_access_tokens_mean_no_tokens() -> None:
    settings = load_settings({"ACCESS_TOKENS": " , "})

    assert settings.access_tokens == ()


def test_openai_api_key_is_read() -> None:
    settings = load_settings({"OPENAI_API_KEY": "sk-test"})

    assert settings.openai_api_key == "sk-test"


def test_blank_openai_api_key_counts_as_missing() -> None:
    settings = load_settings({"OPENAI_API_KEY": "  "})

    assert settings.openai_api_key is None


def test_transcription_model_can_be_overridden() -> None:
    settings = load_settings({"TRANSCRIPTION_MODEL": "gpt-4o-transcribe"})

    assert settings.transcription_model == "gpt-4o-transcribe"


def test_blank_transcription_model_uses_default() -> None:
    settings = load_settings({"TRANSCRIPTION_MODEL": " "})

    assert settings.transcription_model == DEFAULT_TRANSCRIPTION_MODEL


def test_structuring_model_can_be_overridden() -> None:
    settings = load_settings({"STRUCTURING_MODEL": " gpt-5-nano "})

    assert settings.structuring_model == "gpt-5-nano"


def test_blank_structuring_model_uses_default() -> None:
    settings = load_settings({"STRUCTURING_MODEL": " "})

    assert settings.structuring_model == DEFAULT_STRUCTURING_MODEL


def test_default_database_path_is_backend_data_folder() -> None:
    backend_dir = Path(__file__).parents[1]

    assert DEFAULT_DATABASE_PATH == backend_dir / "data" / "escandaya.db"


def test_database_path_can_be_overridden() -> None:
    settings = load_settings({"DATABASE_PATH": " /data/escandaya.db "})

    assert settings.database_path == Path("/data/escandaya.db")


def test_blank_database_path_uses_default() -> None:
    settings = load_settings({"DATABASE_PATH": " "})

    assert settings.database_path == DEFAULT_DATABASE_PATH

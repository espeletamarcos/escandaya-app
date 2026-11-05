from backend.settings import DEFAULT_TRANSCRIPTION_MODEL, load_settings


def test_empty_environment_uses_safe_defaults() -> None:
    settings = load_settings({})

    assert settings.access_tokens == ()
    assert settings.openai_api_key is None
    assert settings.transcription_model == DEFAULT_TRANSCRIPTION_MODEL == "gpt-4o-mini-transcribe"


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

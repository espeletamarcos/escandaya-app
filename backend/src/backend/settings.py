import os
from collections.abc import Mapping
from dataclasses import dataclass

DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"


@dataclass(frozen=True)
class Settings:
    access_tokens: tuple[str, ...]
    openai_api_key: str | None
    transcription_model: str


def _clean(value: str | None) -> str | None:
    """Strip a value and treat blank as missing."""
    if value is None:
        return None
    value = value.strip()
    return value or None


def load_settings(env: Mapping[str, str] = os.environ) -> Settings:
    """Read the settings from the environment (or any mapping, for tests)."""
    tokens = tuple(
        token for token in (part.strip() for part in env.get("ACCESS_TOKENS", "").split(",")) if token
    )
    return Settings(
        access_tokens=tokens,
        openai_api_key=_clean(env.get("OPENAI_API_KEY")),
        transcription_model=_clean(env.get("TRANSCRIPTION_MODEL")) or DEFAULT_TRANSCRIPTION_MODEL,
    )

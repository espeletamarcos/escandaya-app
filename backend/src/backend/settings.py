import os
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache

DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
# Until the structuring trial (04-C8) picks a model.
DEFAULT_STRUCTURING_MODEL = "gpt-5-mini"


@dataclass(frozen=True)
class Settings:
    access_tokens: tuple[str, ...]
    openai_api_key: str | None
    transcription_model: str
    structuring_model: str


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
        structuring_model=_clean(env.get("STRUCTURING_MODEL")) or DEFAULT_STRUCTURING_MODEL,
    )


@lru_cache
def get_settings() -> Settings:
    """FastAPI dependency: the environment is read once. Tests override it."""
    return load_settings()

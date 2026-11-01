from typing import Annotated, Protocol

from fastapi import Depends, HTTPException

from backend.settings import Settings, get_settings


class Transcriber(Protocol):
    """Turns a voice note into text. Language and model are fixed by the implementation."""

    def transcribe(self, audio: bytes, content_type: str) -> str: ...


def get_transcriber(settings: Annotated[Settings, Depends(get_settings)]) -> Transcriber:
    """FastAPI dependency for the transcriber. Tests override it with a fake."""
    # Task 8 returns an OpenAITranscriber here when settings.openai_api_key is set.
    raise HTTPException(status_code=503, detail="Transcription is not configured")

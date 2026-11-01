from typing import Annotated, Protocol

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from backend.settings import Settings, get_settings

# Chrome records audio/webm, iOS Safari records audio/mp4.
SUPPORTED_TYPES = frozenset({"audio/webm", "audio/mp4"})

# A 2-minute voice note with margin. Provisional until real recordings are measured.
MAX_AUDIO_BYTES = 5 * 1024 * 1024


def _too_large() -> HTTPException:
    return HTTPException(status_code=413, detail="Audio is too large")


async def read_audio(request: Request) -> bytes:
    """Read the body, refusing anything over MAX_AUDIO_BYTES without loading it all."""
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > MAX_AUDIO_BYTES:
        raise _too_large()

    audio = bytearray()
    async for chunk in request.stream():
        audio.extend(chunk)
        if len(audio) > MAX_AUDIO_BYTES:
            raise _too_large()
    return bytes(audio)


class Transcriber(Protocol):
    """Turns a voice note into text. Language and model are fixed by the implementation."""

    def transcribe(self, audio: bytes, content_type: str) -> str: ...


def get_transcriber(settings: Annotated[Settings, Depends(get_settings)]) -> Transcriber:
    """FastAPI dependency for the transcriber. Tests override it with a fake."""
    # Task 8 returns an OpenAITranscriber here when settings.openai_api_key is set.
    raise HTTPException(status_code=503, detail="Transcription is not configured")


def audio_type(content_type: Annotated[str | None, Header()] = None) -> str:
    """The base audio type of the request (codec parameters dropped), or 415."""
    base = (content_type or "").split(";", 1)[0].strip().lower()
    if base not in SUPPORTED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported audio type")
    return base


class TranscriptionResponse(BaseModel):
    text: str


# Mounted inside the protected router in main.py, so it requires a token.
router = APIRouter()


@router.post("/transcriptions")
async def create_transcription(
    request: Request,
    # Declared before the transcriber, so a wrong type is reported before a missing key.
    content_type: Annotated[str, Depends(audio_type)],
    transcriber: Annotated[Transcriber, Depends(get_transcriber)],
) -> TranscriptionResponse:
    audio = await read_audio(request)
    # The transcriber blocks on a network call; keep it off the event loop.
    text = await run_in_threadpool(transcriber.transcribe, audio, content_type)
    return TranscriptionResponse(text=text)

import logging
import time
from functools import lru_cache
from typing import Annotated, Protocol

import openai
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from backend.settings import Settings, get_settings

logger = logging.getLogger(__name__)

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


class TranscriptionError(Exception):
    """The provider failed or could not be reached. The message stays server-side."""


class TranscriptionTimeout(TranscriptionError):
    """The provider did not answer in time."""


class Transcriber(Protocol):
    """Turns a voice note into text. Language and model are fixed by the implementation.

    Implementations raise TranscriptionTimeout on timeout and TranscriptionError on any
    other provider or network failure, translating their own exceptions.
    """

    def transcribe(self, audio: bytes, content_type: str) -> str: ...


# The API infers the audio format from the filename extension.
FILENAMES = {"audio/webm": "voice-note.webm", "audio/mp4": "voice-note.mp4"}

OPENAI_TIMEOUT_SECONDS = 60.0


class OpenAITranscriber:
    """Transcribes Spanish voice notes with the OpenAI API, entirely in memory."""

    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        # No SDK retries: a retry could double the wait past the frontend's 90s timeout.
        self.client = openai.OpenAI(
            api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS, max_retries=0
        )

    def transcribe(self, audio: bytes, content_type: str) -> str:
        try:
            result = self.client.audio.transcriptions.create(
                model=self.model,
                file=(FILENAMES[content_type], audio, content_type),
                language="es",
            )
        # APITimeoutError subclasses APIConnectionError, so it must be caught first.
        except openai.APITimeoutError:
            raise TranscriptionTimeout from None
        except openai.OpenAIError:
            raise TranscriptionError from None
        return result.text


@lru_cache(maxsize=1)
def _openai_transcriber(api_key: str, model: str) -> OpenAITranscriber:
    """One client per key and model, so its HTTP connections are reused."""
    return OpenAITranscriber(api_key=api_key, model=model)


def get_transcriber(settings: Annotated[Settings, Depends(get_settings)]) -> Transcriber:
    """FastAPI dependency for the transcriber. Tests override it with a fake."""
    if settings.openai_api_key is None:
        raise HTTPException(status_code=503, detail="Transcription is not configured")
    return _openai_transcriber(settings.openai_api_key, settings.transcription_model)


def audio_type(content_type: Annotated[str | None, Header()] = None) -> str:
    """The base audio type of the request (codec parameters dropped), or 415."""
    base = (content_type or "").split(";", 1)[0].strip().lower()
    if base not in SUPPORTED_TYPES:
        # The sent type is client-controlled text, so it is not logged.
        log_transcription(415)
        raise HTTPException(status_code=415, detail="Unsupported audio type")
    return base


def log_transcription(
    status: int,
    size: int | None = None,
    content_type: str | None = None,
    duration_ms: int | None = None,
) -> None:
    """The only log line for a transcription: never the audio, the text or the headers."""
    logger.info(
        "transcription status=%d bytes=%s type=%s duration_ms=%s",
        status,
        "-" if size is None else size,
        content_type or "-",
        "-" if duration_ms is None else duration_ms,
    )


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
    try:
        audio = await read_audio(request)
    except HTTPException as error:
        log_transcription(error.status_code, content_type=content_type)
        raise

    # The transcriber blocks on a network call; keep it off the event loop.
    # Details are dropped (`from None`): provider messages may echo the key or request ids.
    started = time.perf_counter()
    status = 200
    try:
        text = await run_in_threadpool(transcriber.transcribe, audio, content_type)
    except TranscriptionTimeout:
        status = 504
        raise HTTPException(status_code=504, detail="Transcription timed out") from None
    except TranscriptionError:
        status = 502
        raise HTTPException(status_code=502, detail="Transcription failed") from None
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000)
        log_transcription(status, len(audio), content_type, duration_ms)
    return TranscriptionResponse(text=text)

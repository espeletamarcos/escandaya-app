import logging

import pytest
from conftest import ClientFactory, FakeTranscriber

import backend.main  # noqa: F401  (installs the access-log filter, as uvicorn's import does)
from backend.transcription import (
    MAX_AUDIO_BYTES,
    TranscriptionError,
    TranscriptionTimeout,
)

TOKEN = "chef-secret-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
TRANSCRIPT = "dos kilos de tartar de atún"


def log_access(path: str) -> None:
    """Log a request line exactly the way uvicorn's h11 protocol does."""
    logging.getLogger("uvicorn.access").info(
        '%s - "%s %s HTTP/%s" %d', "127.0.0.1:5000", "GET", path, "1.1", 200
    )


def test_access_log_drops_the_query_string(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="uvicorn.access"):
        log_access(f"/?token={TOKEN}")

    assert TOKEN not in caplog.text
    assert [r.getMessage() for r in caplog.records] == ['127.0.0.1:5000 - "GET / HTTP/1.1" 200']


def test_access_log_keeps_paths_without_query(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="uvicorn.access"):
        log_access("/api/health")

    assert [r.getMessage() for r in caplog.records] == [
        '127.0.0.1:5000 - "GET /api/health HTTP/1.1" 200'
    ]


def test_backend_logs_reach_the_server_output() -> None:
    """Uvicorn only configures its own loggers; ours need a handler to show in `fly logs`."""
    logger = logging.getLogger("backend")

    assert logger.getEffectiveLevel() <= logging.INFO
    assert logger.handlers


def transcription_logs(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "backend.transcription"]


def post(client, body: bytes = b"audio-bytes", content_type: str = "audio/webm"):
    return client.post(
        "/api/transcriptions", content=body, headers={**AUTH, "Content-Type": content_type}
    )


def test_successful_transcription_logs_size_type_duration_and_status(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    client = make_client((TOKEN,), transcriber=FakeTranscriber(text=TRANSCRIPT))

    with caplog.at_level(logging.INFO):
        response = post(client, b"x" * 1234, "audio/webm;codecs=opus")

    assert response.status_code == 200
    [record] = transcription_logs(caplog)
    message = record.getMessage()
    assert "status=200" in message
    assert "bytes=1234" in message
    assert "type=audio/webm" in message
    assert "duration_ms=" in message
    assert TOKEN not in caplog.text
    assert TRANSCRIPT not in caplog.text


@pytest.mark.parametrize(
    ("error", "status"),
    [
        (TranscriptionError(f"provider echoed {TOKEN}: {TRANSCRIPT}"), 502),
        (TranscriptionTimeout(f"timed out for {TOKEN}"), 504),
    ],
)
def test_failed_transcription_logs_only_the_status(
    make_client: ClientFactory,
    caplog: pytest.LogCaptureFixture,
    error: Exception,
    status: int,
) -> None:
    client = make_client((TOKEN,), transcriber=FakeTranscriber(error=error))

    with caplog.at_level(logging.INFO):
        response = post(client)

    assert response.status_code == status
    [record] = transcription_logs(caplog)
    assert f"status={status}" in record.getMessage()
    assert record.exc_info is None
    assert TOKEN not in caplog.text
    assert TRANSCRIPT not in caplog.text


def test_too_large_upload_is_logged(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    client = make_client((TOKEN,), transcriber=FakeTranscriber(text=TRANSCRIPT))

    with caplog.at_level(logging.INFO):
        response = post(client, b"x" * (MAX_AUDIO_BYTES + 1))

    assert response.status_code == 413
    [record] = transcription_logs(caplog)
    assert "status=413" in record.getMessage()
    assert TOKEN not in caplog.text


def test_unsupported_type_is_logged_without_the_sent_type(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    client = make_client((TOKEN,), transcriber=FakeTranscriber(text=TRANSCRIPT))

    with caplog.at_level(logging.INFO):
        response = post(client, content_type=f"text/plain; note={TOKEN}")

    assert response.status_code == 415
    [record] = transcription_logs(caplog)
    assert "status=415" in record.getMessage()
    assert TOKEN not in caplog.text

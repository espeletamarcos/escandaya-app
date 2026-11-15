import json
import logging
import re

import pytest
from conftest import ClientFactory, FakeStructurer, FakeTranscriber

import backend.main  # noqa: F401  (installs the access-log filter, as uvicorn's import does)
from backend import preparations
from backend.structuring import StructuringError, StructuringTimeout
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


# --- Structuring (04-C8) ------------------------------------------------------

DICTATION = "Tartar de atún rojo, kilo y medio de atún y un poco de cebollino"
INGREDIENTS = ("Atún rojo", "Cebollino")
SHEET = {
    "name": "Tartar de atún",
    "yield": {"quantity": 2, "unit": "kg", "estimated": True},
    "covers": {"value": None, "estimated": False},
    "ingredients": [
        {"name": "Atún rojo", "quantity": 1.5, "unit": "kg", "estimated": False},
        {"name": "Cebollino", "quantity": None, "unit": None, "estimated": False},
    ],
}


def structuring_logs(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "backend.structuring"]


def post_draft(client, text: str = DICTATION):
    return client.post("/api/drafts", json={"text": text}, headers=AUTH)


def assert_no_content_logged(caplog: pytest.LogCaptureFixture) -> None:
    """Neither the dictation, the sheet nor the token reaches the logs."""
    assert DICTATION not in caplog.text
    assert "Tartar" not in caplog.text
    for name in INGREDIENTS:
        assert name not in caplog.text
    assert TOKEN not in caplog.text


def test_successful_structuring_logs_status_length_duration_and_tokens(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    raw = json.dumps({"is_preparation": True, "sheet": SHEET})
    fake = FakeStructurer(raw=raw, input_tokens=321, output_tokens=123)
    client = make_client((TOKEN,), structurer=fake)

    with caplog.at_level(logging.INFO):
        response = post_draft(client, f"  {DICTATION}  ")

    assert response.status_code == 200
    [record] = structuring_logs(caplog)
    message = record.getMessage()
    assert message.startswith("structuring status=200 ")
    # The length of the trimmed text, which is what the model receives.
    assert f"chars={len(DICTATION)}" in message
    assert "duration_ms=" in message
    assert "input_tokens=321" in message
    assert "output_tokens=123" in message
    assert_no_content_logged(caplog)
    assert raw not in caplog.text


def test_not_a_preparation_is_logged_as_a_success(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    fake = FakeStructurer(raw='{"is_preparation": false, "sheet": null}')
    client = make_client((TOKEN,), structurer=fake)

    with caplog.at_level(logging.INFO):
        response = post_draft(client, "hola, ¿qué tal el servicio?")

    assert response.status_code == 200
    [record] = structuring_logs(caplog)
    assert "status=200" in record.getMessage()
    assert "qué tal" not in caplog.text


def with_unit(unit: str) -> dict:
    return {**SHEET, "ingredients": [{**SHEET["ingredients"][0], "unit": unit}]}


@pytest.mark.parametrize(
    "raw",
    [
        "Atún rojo 1,5 kg; Cebollino {",
        json.dumps({"is_preparation": True, "sheet": with_unit("cucharada")}),
        json.dumps({"is_preparation": True, "sheet": {**SHEET, "covers": "Cebollino"}}),
        json.dumps({"is_preparation": True, "sheet": None, "note": "Atún rojo"}),
        json.dumps({"is_preparation": True, "sheet": None}),
    ],
    ids=[
        "invalid-json",
        "unknown-unit",
        "wrong-type",
        "extra-field",
        "preparation-without-sheet",
    ],
)
def test_invalid_output_logs_502_with_its_tokens_and_no_content(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture, raw: str
) -> None:
    fake = FakeStructurer(raw=raw, input_tokens=400, output_tokens=90)
    client = make_client((TOKEN,), structurer=fake)

    with caplog.at_level(logging.INFO):
        response = post_draft(client)

    assert response.status_code == 502
    [record] = structuring_logs(caplog)
    message = record.getMessage()
    assert "status=502" in message
    # The answer was paid for even though it was unusable.
    assert "input_tokens=400" in message
    assert "output_tokens=90" in message
    # The validation error, which quotes the output, is dropped.
    assert record.exc_info is None
    assert_no_content_logged(caplog)
    assert raw not in caplog.text
    assert "cucharada" not in caplog.text


@pytest.mark.parametrize(
    ("error", "status"),
    [
        (StructuringError(f"provider echoed {TOKEN}: {DICTATION}"), 502),
        (StructuringTimeout(f"timed out: {DICTATION}"), 504),
    ],
    ids=["provider-error", "timeout"],
)
def test_failed_structuring_logs_the_status_without_tokens(
    make_client: ClientFactory,
    caplog: pytest.LogCaptureFixture,
    error: Exception,
    status: int,
) -> None:
    client = make_client((TOKEN,), structurer=FakeStructurer(error=error))

    with caplog.at_level(logging.INFO):
        response = post_draft(client)

    assert response.status_code == status
    [record] = structuring_logs(caplog)
    message = record.getMessage()
    assert f"status={status}" in message
    # No answer came back, so there are no token counts.
    assert "input_tokens=- output_tokens=-" in message
    assert record.exc_info is None
    assert_no_content_logged(caplog)


def test_token_counts_the_provider_omits_are_logged_as_a_dash(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    fake = FakeStructurer(
        raw='{"is_preparation": false, "sheet": null}', input_tokens=None, output_tokens=None
    )
    client = make_client((TOKEN,), structurer=fake)

    with caplog.at_level(logging.INFO):
        post_draft(client)

    [record] = structuring_logs(caplog)
    assert "input_tokens=- output_tokens=-" in record.getMessage()


def test_an_unexpected_error_is_logged_as_500(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    client = make_client((TOKEN,), structurer=FakeStructurer(error=RuntimeError("bug")))

    with caplog.at_level(logging.INFO), pytest.raises(RuntimeError):
        post_draft(client)

    [record] = structuring_logs(caplog)
    assert "status=500" in record.getMessage()


def test_rejected_text_is_not_logged(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    fake = FakeStructurer(raw='{"is_preparation": false, "sheet": null}')
    client = make_client((TOKEN,), structurer=fake)

    with caplog.at_level(logging.INFO):
        response = post_draft(client, "   ")

    # Structuring never ran, so there is no structuring line.
    assert response.status_code == 422
    assert structuring_logs(caplog) == []


# --- Preparations (05-C7) ---------------------------------------------------------

CONFIRM_ID = "3f2b8c1e-5d4a-4c6b-9e7f-1a2b3c4d5e6f"
PREPARATION_LOG = re.compile(r"^preparations action=(confirm|list|detail) status=\d{3} duration_ms=\d+$")


def preparation_logs(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [r.getMessage() for r in caplog.records if r.name == "backend.preparations"]


def post_preparation(client, **changes):
    body = {"confirm_id": CONFIRM_ID, "transcript": DICTATION, "sheet": SHEET, **changes}
    return client.post("/api/preparations", json=body, headers=AUTH)


def test_confirm_logs_only_the_action_status_and_duration(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    client = make_client((TOKEN,))

    with caplog.at_level(logging.INFO):
        response = post_preparation(client)

    assert response.status_code == 201
    [message] = preparation_logs(caplog)
    assert PREPARATION_LOG.match(message)
    assert message.startswith("preparations action=confirm status=201 ")
    assert_no_content_logged(caplog)
    assert CONFIRM_ID not in caplog.text


def test_a_repeated_confirm_is_logged_as_200(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    client = make_client((TOKEN,))
    post_preparation(client)
    caplog.clear()

    with caplog.at_level(logging.INFO):
        post_preparation(client)

    [message] = preparation_logs(caplog)
    assert message.startswith("preparations action=confirm status=200 ")


def test_list_and_detail_log_only_the_action_status_and_duration(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    client = make_client((TOKEN,))
    saved_id = post_preparation(client).json()["id"]
    caplog.clear()

    with caplog.at_level(logging.INFO):
        client.get("/api/preparations", headers=AUTH)
        client.get(f"/api/preparations/{saved_id}", headers=AUTH)
        client.get("/api/preparations/999", headers=AUTH)

    messages = preparation_logs(caplog)
    assert all(PREPARATION_LOG.match(message) for message in messages)
    assert [message.rsplit(" ", 1)[0] for message in messages] == [
        "preparations action=list status=200",
        "preparations action=detail status=200",
        "preparations action=detail status=404",
    ]
    assert_no_content_logged(caplog)


def test_a_rejected_confirm_logs_no_content(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture
) -> None:
    client = make_client((TOKEN,))
    bad_sheet = {**SHEET, "covers": {"value": "cuarenta", "estimated": False}}

    with caplog.at_level(logging.INFO):
        response = post_preparation(client, sheet=bad_sheet)

    # Rejected before the endpoint runs: the access log has its status, we add no line.
    assert response.status_code == 422
    assert preparation_logs(caplog) == []
    assert_no_content_logged(caplog)
    assert "cuarenta" not in caplog.text


def test_an_unexpected_confirm_error_is_logged_as_500(
    make_client: ClientFactory, caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = make_client((TOKEN,))

    def broken(*args, **kwargs):
        raise RuntimeError("bug")

    monkeypatch.setattr(preparations, "find_by_confirm_id", broken)

    with caplog.at_level(logging.INFO), pytest.raises(RuntimeError):
        post_preparation(client)

    [message] = preparation_logs(caplog)
    assert message.startswith("preparations action=confirm status=500 ")
    assert_no_content_logged(caplog)

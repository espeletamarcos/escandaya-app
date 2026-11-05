"""Server logging. Logs must never contain an access token or a transcript (03-C8)."""

import logging


class StripQueryString(logging.Filter):
    """Drops the query string from uvicorn's access-log path, so `/?token=X` logs as `/`.

    Uvicorn passes the path as a format argument, so the arguments are rewritten.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple):
            record.args = tuple(
                arg.split("?", 1)[0] if isinstance(arg, str) and arg.startswith("/") else arg
                for arg in record.args
            )
        return True


def configure_logging() -> None:
    """Install the access-log filter and give the app's loggers an output.

    Uvicorn configures its loggers before importing the app, and that setup keeps
    existing filters, so calling this at import time works with `uvicorn backend.main:app`.
    """
    access = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, StripQueryString) for f in access.filters):
        access.addFilter(StripQueryString())

    # Uvicorn leaves the root logger without handlers, which would hide our INFO lines.
    app_logger = logging.getLogger("backend")
    app_logger.setLevel(logging.INFO)
    if not app_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s - %(message)s"))
        app_logger.addHandler(handler)

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from backend.settings import Settings, get_settings


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=401, headers={"WWW-Authenticate": "Bearer"})


def require_token(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Accept only `Authorization: Bearer <token>` with a configured token."""
    scheme, _, token = (authorization or "").partition(" ")
    if scheme != "Bearer" or not token:
        raise _unauthorized()
    # Check every token (no early exit) and compare in constant time.
    valid = False
    for expected in settings.access_tokens:
        valid |= secrets.compare_digest(token.encode(), expected.encode())
    if not valid:
        raise _unauthorized()

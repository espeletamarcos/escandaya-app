from pathlib import Path

from conftest import ClientFactory

TOKENS = ("chef-token", "owner-token")


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_session_without_header_is_rejected(make_client: ClientFactory) -> None:
    response = make_client(TOKENS).get("/api/session")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_session_with_wrong_token_is_rejected(make_client: ClientFactory) -> None:
    response = make_client(TOKENS).get("/api/session", headers=bearer("wrong"))

    assert response.status_code == 401


def test_session_without_bearer_prefix_is_rejected(make_client: ClientFactory) -> None:
    response = make_client(TOKENS).get("/api/session", headers={"Authorization": "chef-token"})

    assert response.status_code == 401


def test_session_with_empty_bearer_is_rejected(make_client: ClientFactory) -> None:
    response = make_client(TOKENS).get("/api/session", headers={"Authorization": "Bearer "})

    assert response.status_code == 401


def test_every_configured_token_is_accepted(make_client: ClientFactory) -> None:
    client = make_client(TOKENS)

    for token in TOKENS:
        response = client.get("/api/session", headers=bearer(token))

        assert response.status_code == 204
        assert response.content == b""


def test_empty_token_list_rejects_everything(make_client: ClientFactory) -> None:
    client = make_client(())

    assert client.get("/api/session").status_code == 401
    assert client.get("/api/session", headers=bearer("")).status_code == 401
    assert client.get("/api/session", headers=bearer("anything")).status_code == 401


def test_health_stays_public(make_client: ClientFactory) -> None:
    response = make_client(TOKENS).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_static_frontend_stays_public(make_client: ClientFactory, tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html>app</html>")

    response = make_client(TOKENS, static_dir=tmp_path).get("/")

    assert response.status_code == 200
    assert response.text == "<html>app</html>"


def test_get_settings_reads_the_environment(monkeypatch) -> None:
    from backend.settings import get_settings

    monkeypatch.setenv("ACCESS_TOKENS", "from-env")
    get_settings.cache_clear()
    try:
        assert get_settings().access_tokens == ("from-env",)
    finally:
        get_settings.cache_clear()

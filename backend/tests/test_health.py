from fastapi.testclient import TestClient

from backend.main import create_app

client = TestClient(create_app(static_dir=None))


def test_health_returns_ok() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_not_served_outside_api() -> None:
    response = client.get("/health")

    assert response.status_code == 404
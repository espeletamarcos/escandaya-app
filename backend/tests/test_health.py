from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    # Not started: these requests do not need the database.
    return TestClient(create_app(static_dir=None, database_path=tmp_path / "app.db"))


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_not_served_outside_api(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 404
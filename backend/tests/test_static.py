from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "sw.js").write_text("console.log('sw')")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log('app')")
    (tmp_path.parent / "secret.txt").write_text("secret")
    return TestClient(create_app(static_dir=tmp_path))


def test_root_serves_index(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.text == "<html>app</html>"


def test_serves_existing_files(client: TestClient) -> None:
    response = client.get("/assets/app.js")

    assert response.status_code == 200
    assert response.text == "console.log('app')"


def test_unknown_route_falls_back_to_index(client: TestClient) -> None:
    response = client.get("/some/client/route")

    assert response.status_code == 200
    assert response.text == "<html>app</html>"


def test_missing_file_is_not_replaced_by_index(client: TestClient) -> None:
    response = client.get("/assets/missing.js")

    assert response.status_code == 404


def test_unknown_api_path_is_not_replaced_by_index(client: TestClient) -> None:
    response = client.get("/api/unknown")

    assert response.status_code == 404
    assert "app" not in response.text


def test_api_still_works_with_static_files(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.json() == {"status": "ok"}


def test_cannot_read_files_outside_static_dir(client: TestClient) -> None:
    response = client.get("/%2e%2e/secret.txt")

    assert response.text != "secret"


def test_without_static_dir_only_the_api_is_served() -> None:
    client = TestClient(create_app(static_dir=None))

    assert client.get("/api/health").status_code == 200
    assert client.get("/").status_code == 404

"""FastAPI route tests using the sync TestClient."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.auth import User, get_current_user


@pytest.fixture
def fake_user() -> User:
    return User(uid="test-user-1", email="test@example.com")


@pytest.fixture
def client(fake_user: User) -> TestClient:
    from app.main import app as fastapi_app

    fastapi_app.dependency_overrides[get_current_user] = lambda: fake_user
    yield TestClient(fastapi_app)
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def anon_client() -> TestClient:
    """Client with no auth override — used to verify endpoints reject anonymous calls."""
    from app.main import app as fastapi_app

    return TestClient(fastapi_app)


def test_health_check(anon_client: TestClient):
    response = anon_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_upload_rejects_wrong_format(client: TestClient):
    files = {"file": ("photo.jpg", b"not really a jpg", "image/jpeg")}
    response = client.post("/api/v1/upload-resume", files=files)

    assert response.status_code == 422
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_rejects_large_file(client: TestClient):
    big = b"x" * (6 * 1024 * 1024)
    files = {"file": ("big.pdf", big, "application/pdf")}
    response = client.post("/api/v1/upload-resume", files=files)

    assert response.status_code == 413
    assert "5MB" in response.json()["detail"]


def test_upload_requires_auth(anon_client: TestClient):
    files = {"file": ("r.pdf", b"x", "application/pdf")}
    response = anon_client.post("/api/v1/upload-resume", files=files)
    assert response.status_code == 401


def test_scrape_jd_bad_url_returns_failure(client: TestClient):
    response = client.post(
        "/api/v1/scrape-jd",
        json={"url": "http://this-domain-does-not-exist-xyz123.invalid/"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["jd_text"] is None
    assert body["message"]


def test_scrape_jd_requires_auth(anon_client: TestClient):
    response = anon_client.post(
        "/api/v1/scrape-jd",
        json={"url": "http://example.com/"},
    )
    assert response.status_code == 401


def test_pipeline_status_404_when_foreign(anon_client: TestClient, fake_user: User):
    """A user must not see another user's pipeline."""
    from unittest.mock import AsyncMock, MagicMock

    from app.api.v1.endpoints import pipeline as pipeline_module
    from app.main import app as fastapi_app

    snapshot = MagicMock()
    snapshot.exists = True
    snapshot.to_dict = MagicMock(
        return_value={"user_id": "someone-else", "overall_status": "done"}
    )
    doc = MagicMock()
    doc.get = AsyncMock(return_value=snapshot)
    coll = MagicMock()
    coll.document = MagicMock(return_value=doc)
    fake_fs = MagicMock()
    fake_fs.collection = MagicMock(return_value=coll)

    fastapi_app.dependency_overrides[get_current_user] = lambda: fake_user
    original = pipeline_module.get_firestore_client
    pipeline_module.get_firestore_client = lambda: fake_fs
    try:
        client = TestClient(fastapi_app)
        response = client.get(
            "/api/v1/pipeline/some-pipeline-id/status",
            headers={"Authorization": "Bearer ignored-in-override"},
        )
        assert response.status_code == 404
    finally:
        pipeline_module.get_firestore_client = original
        fastapi_app.dependency_overrides.pop(get_current_user, None)

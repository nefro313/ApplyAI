"""Tests for the v1 endpoints added in phases 2-7.

These mock Firestore + GCS + the agent runners so they don't touch the
network. They cover the parts most likely to silently break: ownership
checks, validation, and the cache/short-circuit behaviour we rely on.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.auth import User, get_current_user


@pytest.fixture
def fake_user() -> User:
    return User(uid="test-user-1", email="test@example.com")


@pytest.fixture
def app_under_test(fake_user: User):
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: fake_user
    yield app
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def client(app_under_test) -> TestClient:
    return TestClient(app_under_test)


def _mk_snapshot(data: dict | None) -> MagicMock:
    snap = MagicMock()
    snap.exists = data is not None
    snap.to_dict = MagicMock(return_value=data)
    snap.id = "snap-id"
    return snap


def _mk_doc(snapshot_data: dict | None) -> tuple[MagicMock, MagicMock]:
    """Returns (doc, set_mock) so tests can assert on set/merge writes."""
    doc = MagicMock()
    doc.get = AsyncMock(return_value=_mk_snapshot(snapshot_data))
    doc.set = AsyncMock()
    return doc, doc.set


def _mk_firestore_for_pipeline(pipeline_data: dict | None, resume_data: dict | None = None):
    """Build a fake Firestore that routes pipelines/* and resumes/* collections."""
    pipeline_doc, _ = _mk_doc(pipeline_data)
    resume_doc, _ = _mk_doc(resume_data)

    pipelines_coll = MagicMock()
    pipelines_coll.document = MagicMock(return_value=pipeline_doc)
    resumes_coll = MagicMock()
    resumes_coll.document = MagicMock(return_value=resume_doc)

    fs = MagicMock()

    def collection_router(name: str):
        if name == "pipelines":
            return pipelines_coll
        if name == "resumes":
            return resumes_coll
        return MagicMock()

    fs.collection = MagicMock(side_effect=collection_router)
    return fs, pipeline_doc, resume_doc


# ---------------------------------------------------------------------------
# /api/v1/me/*
# ---------------------------------------------------------------------------


def test_me_resumes_filters_by_user(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import me as me_mod

    async def stream(self_unused):
        yield _mk_snapshot(
            {
                "user_id": fake_user.uid,
                "file_type": "pdf",
                "uploaded_at": None,
                "raw_text": "hello world",
                "parsed": {"candidate_name": "Jane Doe"},
            }
        )

    query = MagicMock()
    query.limit = MagicMock(return_value=query)
    query.stream = lambda: stream(None)
    coll = MagicMock()
    coll.where = MagicMock(return_value=query)
    fs = MagicMock()
    fs.collection = MagicMock(return_value=coll)

    with patch.object(me_mod, "get_firestore_client", return_value=fs):
        r = client.get("/api/v1/me/resumes")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["candidate_name"] == "Jane Doe"
    coll.where.assert_called_with("user_id", "==", fake_user.uid)


def test_me_pipelines_filters_by_user(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import me as me_mod

    async def stream(self_unused):
        yield _mk_snapshot(
            {
                "overall_status": "done",
                "role_title": "ML Eng",
                "company_name": "Acme",
                "candidate_name": "Jane Doe",
                "ats_score": {"final_score": 88},
                "started_at": None,
                "updated_at": None,
            }
        )

    query = MagicMock()
    query.limit = MagicMock(return_value=query)
    query.stream = lambda: stream(None)
    coll = MagicMock()
    coll.where = MagicMock(return_value=query)
    fs = MagicMock()
    fs.collection = MagicMock(return_value=coll)

    with patch.object(me_mod, "get_firestore_client", return_value=fs):
        r = client.get("/api/v1/me/pipelines")
    assert r.status_code == 200
    items = r.json()
    assert items[0]["final_score"] == 88
    assert items[0]["role_title"] == "ML Eng"


# ---------------------------------------------------------------------------
# /api/v1/pipeline/start ownership
# ---------------------------------------------------------------------------


def test_pipeline_start_rejects_foreign_resume(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, resume_doc = _mk_firestore_for_pipeline(
        pipeline_data=None, resume_data={"user_id": "someone-else"}
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.post(
            "/api/v1/pipeline/start",
            json={
                "file_id": "abc",
                "job_input": {"url": None, "raw_jd": "Lots of words. " * 30},
                "want_cover_letter": False,
            },
        )
    assert r.status_code == 404
    resume_doc.get.assert_awaited()


def test_pipeline_start_writes_user_id(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, pipeline_doc, _ = _mk_firestore_for_pipeline(
        pipeline_data=None,
        resume_data={"user_id": fake_user.uid, "raw_text": "..."},
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs), patch.object(
        pipe_mod, "_run_pipeline_bg", AsyncMock()
    ):
        r = client.post(
            "/api/v1/pipeline/start",
            json={
                "file_id": "abc",
                "job_input": {"url": None, "raw_jd": "x" * 200},
                "want_cover_letter": False,
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "started"
    pipeline_doc.set.assert_awaited()
    # Only one set call should have happened — the initial pipeline record.
    written = pipeline_doc.set.call_args_list[0].args[0]
    assert written["user_id"] == fake_user.uid
    assert written["file_id"] == "abc"


# ---------------------------------------------------------------------------
# /api/v1/pipeline/{id}/review + apply-changes
# ---------------------------------------------------------------------------


def test_review_returns_proposed_changes(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={
            "user_id": fake_user.uid,
            "overall_status": "awaiting_review",
            "candidate_name": "Jane Doe",
            "role_title": "ML Eng",
            "company_name": "Acme",
            "fit_summary": "strong fit",
            "proposed_changes": [
                {
                    "id": "chg_1",
                    "category": "summary",
                    "title": "Tailor summary",
                    "detail": "Emphasize real ML strengths",
                    "accepted": True,
                }
            ],
        }
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.get("/api/v1/pipeline/pid-1/review")
    assert r.status_code == 200
    body = r.json()
    assert body["candidate_name"] == "Jane Doe"
    assert len(body["proposed_changes"]) == 1
    assert body["proposed_changes"][0]["id"] == "chg_1"


def test_review_409_while_running(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": fake_user.uid, "overall_status": "running"}
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.get("/api/v1/pipeline/pid-1/review")
    assert r.status_code == 409


def test_apply_changes_flips_flags_and_kicks_generation(
    client: TestClient, fake_user: User
):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, pipeline_doc, _ = _mk_firestore_for_pipeline(
        pipeline_data={
            "user_id": fake_user.uid,
            "overall_status": "awaiting_review",
            "proposed_changes": [
                {"id": "chg_1", "category": "summary", "title": "a", "detail": "", "accepted": True},
                {"id": "chg_2", "category": "skills", "title": "b", "detail": "", "accepted": True},
            ],
        }
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs), patch.object(
        pipe_mod, "_run_generation_bg", AsyncMock()
    ):
        r = client.post(
            "/api/v1/pipeline/pid-1/apply-changes",
            json={"accepted_ids": ["chg_1"], "notes": "make it punchy"},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "running"
    written = pipeline_doc.set.call_args_list[-1].args[0]
    assert written["overall_status"] == "running"
    changes = {c["id"]: c["accepted"] for c in written["proposed_changes"]}
    assert changes == {"chg_1": True, "chg_2": False}
    assert "analyst_report" in written  # notes folded in


def test_apply_changes_records_selections_and_template(
    client: TestClient, fake_user: User
):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, pipeline_doc, _ = _mk_firestore_for_pipeline(
        pipeline_data={
            "user_id": fake_user.uid,
            "overall_status": "awaiting_review",
            "template_id": "classic",
            "proposed_changes": [
                {
                    "id": "chg_1",
                    "category": "summary",
                    "title": "a",
                    "detail": "",
                    "options": [
                        {"id": "original", "label": "Keep original", "text": "old", "kind": "original"},
                        {"id": "opt_1", "label": "A", "text": "new a", "kind": "ai"},
                        {"id": "custom", "label": "Write my own", "text": "", "kind": "custom"},
                    ],
                    "accepted": True,
                },
                {
                    "id": "chg_2",
                    "category": "experience",
                    "title": "b",
                    "detail": "",
                    "options": [
                        {"id": "opt_1", "label": "A", "text": "x", "kind": "ai"},
                        {"id": "custom", "label": "Write my own", "text": "", "kind": "custom"},
                    ],
                    "accepted": True,
                },
                {
                    "id": "chg_3",
                    "category": "skills",
                    "title": "Group skills",
                    "detail": "",
                    "chips": ["Python", "Pandas", "PostgreSQL", "Git"],
                    "selected_chips": ["Python", "Pandas", "PostgreSQL", "Git"],
                    "accepted": True,
                },
            ],
        }
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs), patch.object(
        pipe_mod, "_run_generation_bg", AsyncMock()
    ):
        r = client.post(
            "/api/v1/pipeline/pid-1/apply-changes",
            json={
                "selections": [
                    {"id": "chg_1", "accepted": True, "option_id": "opt_1"},
                    {
                        "id": "chg_2",
                        "accepted": True,
                        "option_id": "custom",
                        "custom_text": "my own words",
                    },
                    {
                        "id": "chg_3",
                        "accepted": True,
                        "selected_chips": ["Python", "PostgreSQL"],
                    },
                ],
                "template_id": "minimal",
            },
        )
    assert r.status_code == 200
    written = pipeline_doc.set.call_args_list[-1].args[0]
    assert written["template_id"] == "minimal"
    by_id = {c["id"]: c for c in written["proposed_changes"]}
    assert by_id["chg_1"]["selected_option_id"] == "opt_1"
    assert by_id["chg_2"]["selected_option_id"] == "custom"
    assert by_id["chg_2"]["custom_text"] == "my own words"
    assert by_id["chg_3"]["selected_chips"] == ["Python", "PostgreSQL"]


def test_apply_changes_409_when_not_awaiting(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": fake_user.uid, "overall_status": "done"}
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.post(
            "/api/v1/pipeline/pid-1/apply-changes",
            json={"accepted_ids": []},
        )
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# DELETE /api/v1/pipeline/{id} + DELETE /api/v1/me/pipelines
# ---------------------------------------------------------------------------


def test_delete_pipeline_removes_owned(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, pipeline_doc, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": fake_user.uid, "overall_status": "done"}
    )
    pipeline_doc.delete = AsyncMock()
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs), patch.object(
        pipe_mod, "delete_gcs_prefix", return_value=2
    ) as gcs:
        r = client.delete("/api/v1/pipeline/pid-1")
    assert r.status_code == 200
    assert r.json()["status"] == "deleted"
    pipeline_doc.delete.assert_awaited_once()
    gcs.assert_called_once_with("pipelines/pid-1/")


def test_delete_pipeline_rejects_foreign(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, pipeline_doc, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": "someone-else", "overall_status": "done"}
    )
    pipeline_doc.delete = AsyncMock()
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.delete("/api/v1/pipeline/pid-1")
    assert r.status_code == 404
    pipeline_doc.delete.assert_not_called()


def test_delete_all_my_pipelines(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import me as me_mod

    async def stream(_unused):
        yield _mk_snapshot({"user_id": fake_user.uid})
        yield _mk_snapshot({"user_id": fake_user.uid})

    query = MagicMock()
    query.stream = lambda: stream(None)
    doc = MagicMock()
    doc.delete = AsyncMock()
    coll = MagicMock()
    coll.where = MagicMock(return_value=query)
    coll.document = MagicMock(return_value=doc)
    fs = MagicMock()
    fs.collection = MagicMock(return_value=coll)

    with patch.object(me_mod, "get_firestore_client", return_value=fs), patch.object(
        me_mod, "delete_gcs_prefix", return_value=0
    ):
        r = client.delete("/api/v1/me/pipelines")
    assert r.status_code == 200
    assert r.json()["deleted"] == 2
    assert doc.delete.await_count == 2
    coll.where.assert_called_with("user_id", "==", fake_user.uid)


# ---------------------------------------------------------------------------
# /api/v1/pipeline/{id}/regenerate-resume
# ---------------------------------------------------------------------------


def test_regenerate_resume_requires_finished_pipeline(
    client: TestClient, fake_user: User
):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": fake_user.uid, "overall_status": "running"}
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.post(
            "/api/v1/pipeline/pid-1/regenerate-resume",
            json={"notes": "more keywords pls"},
        )
    assert r.status_code == 409


def test_regenerate_resume_rejects_foreign_pipeline(
    client: TestClient, fake_user: User
):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": "someone-else", "overall_status": "done"}
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.post(
            "/api/v1/pipeline/pid-1/regenerate-resume",
            json={"notes": None},
        )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# /api/v1/pipeline/{id}/export
# ---------------------------------------------------------------------------


def test_export_rejects_foreign_pipeline(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": "someone-else", "overall_status": "done"}
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.get("/api/v1/pipeline/pid-1/export?format=pdf")
    assert r.status_code == 404


def test_export_404_for_missing_cover_letter(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={
            "user_id": fake_user.uid,
            "overall_status": "done",
            # cover_letter_pdf_url intentionally absent
        }
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.get("/api/v1/pipeline/pid-1/export?format=cover_pdf")
    assert r.status_code == 404


def test_export_returns_fresh_signed_url(client: TestClient, fake_user: User):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": fake_user.uid, "overall_status": "done"}
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs), patch.object(
        pipe_mod, "fresh_signed_url", return_value="https://example.com/signed"
    ):
        r = client.get("/api/v1/pipeline/pid-1/export?format=pdf")
    assert r.status_code == 200
    body = r.json()
    assert body["url"] == "https://example.com/signed"
    assert body["filename"] == "resume.pdf"


def test_export_validates_format(client: TestClient):
    r = client.get("/api/v1/pipeline/pid-1/export?format=jpeg")
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# /api/v1/pipeline/{id}/interview-prep
# ---------------------------------------------------------------------------


def test_interview_prep_uses_cache_when_present(
    client: TestClient, fake_user: User
):
    """If the doc already has interview_prep, we should not invoke the agent."""
    from app.api.v1.endpoints import pipeline as pipe_mod

    cached = {
        "behavioral": [
            {"question": "tell me about yourself", "suggested_answer": "I…", "anchor": "x"}
        ],
        "technical": [],
        "role_specific": [],
        "questions_to_ask": [],
        "watch_outs": [],
    }
    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={
            "user_id": fake_user.uid,
            "overall_status": "done",
            "interview_prep": cached,
        }
    )
    agent_mock = AsyncMock()
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs), patch.object(
        pipe_mod, "run_interview_prep", agent_mock
    ):
        r = client.post("/api/v1/pipeline/pid-1/interview-prep")
    assert r.status_code == 200
    assert r.json()["behavioral"][0]["question"] == "tell me about yourself"
    agent_mock.assert_not_awaited()


def test_interview_prep_requires_finished_pipeline(
    client: TestClient, fake_user: User
):
    from app.api.v1.endpoints import pipeline as pipe_mod

    fs, _, _ = _mk_firestore_for_pipeline(
        pipeline_data={"user_id": fake_user.uid, "overall_status": "running"}
    )
    with patch.object(pipe_mod, "get_firestore_client", return_value=fs):
        r = client.post("/api/v1/pipeline/pid-1/interview-prep")
    assert r.status_code == 409

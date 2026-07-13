"""User-scoped history endpoints: /api/v1/me/resumes, /api/v1/me/pipelines."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query

from app.core.auth import User, get_current_user
from app.core.gcp import get_firestore_client
from app.core.rate_limit import rate_limit
from app.schemas.history import PipelineSummary, ResumeSummary
from app.tools.document_builder import delete_gcs_prefix

router = APIRouter(prefix="/me", tags=["me"])

RESUMES_COLLECTION = "resumes"
PIPELINES_COLLECTION = "pipelines"

delete_all_rate_limit = rate_limit("pipelines_delete_all", limit=10, window_seconds=3600)


def _to_int_score(raw: dict | None) -> int | None:
    if not isinstance(raw, dict):
        return None
    value = raw.get("final_score") or raw.get("score")
    return int(value) if isinstance(value, (int, float)) else None


@router.get("/resumes", response_model=list[ResumeSummary])
async def list_my_resumes(
    user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[ResumeSummary]:
    coll = get_firestore_client().collection(RESUMES_COLLECTION)
    query = coll.where("user_id", "==", user.uid).limit(limit)

    results: list[ResumeSummary] = []
    async for snap in query.stream():
        data = snap.to_dict() or {}
        parsed = data.get("parsed") or {}
        results.append(
            ResumeSummary(
                file_id=snap.id,
                file_type=data.get("file_type", ""),
                uploaded_at=data.get("uploaded_at"),
                text_length=len(data.get("raw_text", "") or ""),
                candidate_name=parsed.get("candidate_name")
                if isinstance(parsed, dict)
                else None,
            )
        )
    results.sort(key=lambda r: r.uploaded_at or 0, reverse=True)
    return results


@router.get("/pipelines", response_model=list[PipelineSummary])
async def list_my_pipelines(
    user: User = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[PipelineSummary]:
    coll = get_firestore_client().collection(PIPELINES_COLLECTION)
    query = coll.where("user_id", "==", user.uid).limit(limit)

    results: list[PipelineSummary] = []
    async for snap in query.stream():
        data = snap.to_dict() or {}
        results.append(
            PipelineSummary(
                pipeline_id=snap.id,
                overall_status=data.get("overall_status", "unknown"),
                role_title=data.get("role_title"),
                company_name=data.get("company_name"),
                candidate_name=data.get("candidate_name"),
                final_score=_to_int_score(data.get("ats_score")),
                started_at=data.get("started_at"),
                updated_at=data.get("updated_at"),
                duration_seconds=data.get("duration_seconds"),
            )
        )
    results.sort(key=lambda r: r.updated_at or r.started_at or "", reverse=True)
    return results


@router.delete("/pipelines", dependencies=[Depends(delete_all_rate_limit)])
async def delete_all_my_pipelines(
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    """Delete every pipeline owned by the caller — generated GCS artifacts plus
    the Firestore records. Returns the number deleted."""
    coll = get_firestore_client().collection(PIPELINES_COLLECTION)
    query = coll.where("user_id", "==", user.uid)

    deleted = 0
    async for snap in query.stream():
        # Best-effort artifact cleanup, then drop the record.
        await asyncio.to_thread(delete_gcs_prefix, f"{PIPELINES_COLLECTION}/{snap.id}/")
        await coll.document(snap.id).delete()
        deleted += 1
    return {"deleted": deleted}

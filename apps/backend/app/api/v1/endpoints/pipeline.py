from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from pydantic import BaseModel

from app.agents.interview_prep import run_interview_prep
from app.agents.orchestrator import (
    PIPELINES_COLLECTION,
    run_generation_phase,
    run_pipeline,
)
from app.agents._tracing import pipeline_trace_context
from app.agents.recruiter_review import run_recruiter_review
from app.agents.resume_risks import run_resume_risks
from app.agents.resume_structurer import run_resume_structurer
from app.agents.resume_writer import run_resume_writer_with_feedback
from app.agents.skill_roadmap import run_skill_roadmap
from app.core.auth import User, get_current_user
from app.core.gcp import get_firestore_client
from app.core.rate_limit import rate_limit
from app.schemas.growth import SkillRoadmap
from app.schemas.interview import InterviewPrep
from app.schemas.jd import JDAnalysis
from app.schemas.recruiter import RecruiterReview
from app.schemas.risks import ResumeRisks
from app.schemas.pipeline import (
    AgentStatus,
    PipelineProgress,
    PipelineRequest,
    PipelineResult,
    PipelineReview,
    ProposedChange,
    ResumeTemplate,
)
from app.schemas.resume import ParsedResume
from app.tools.document_builder import (
    build_resume_pdf,
    delete_gcs_prefix,
    fresh_signed_url,
    upload_document_to_gcs,
)
from app.tools.resume_render import DEFAULT_TEMPLATE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pipeline", tags=["pipeline"])

POLL_INTERVAL_SECONDS = 1.5
STREAM_MAX_POLLS = 600  # ~15 minutes ceiling
RESUMES_COLLECTION = "resumes"

pipeline_rate_limit = rate_limit("pipeline_start", limit=20, window_seconds=3600)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc_ref(pipeline_id: str):
    return get_firestore_client().collection(PIPELINES_COLLECTION).document(pipeline_id)


async def _load_owned_pipeline(pipeline_id: str, uid: str) -> dict:
    snapshot = await _doc_ref(pipeline_id).get()
    if not snapshot.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="pipeline not found"
        )
    data = snapshot.to_dict() or {}
    if data.get("user_id") != uid:
        # Return 404 (not 403) to avoid leaking existence of foreign pipelines.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="pipeline not found"
        )
    return data


def _make_progress_callback(pipeline_id: str):
    doc_ref = _doc_ref(pipeline_id)

    async def callback(agent_status: AgentStatus) -> None:
        snapshot = await doc_ref.get()
        data = snapshot.to_dict() or {}
        steps: list[dict] = list(data.get("steps", []))

        new_step = agent_status.model_dump(mode="json")
        for i, existing in enumerate(steps):
            if existing.get("name") == agent_status.name:
                merged = {**existing, **{k: v for k, v in new_step.items() if v is not None}}
                steps[i] = merged
                break
        else:
            steps.append(new_step)

        update: dict = {
            "steps": steps,
            "current_step": agent_status.name,
            "updated_at": _now_iso(),
        }
        if agent_status.state in ("running", "done", "skipped"):
            update["overall_status"] = data.get("overall_status") or "running"
            if update["overall_status"] == "started":
                update["overall_status"] = "running"
        await doc_ref.set(update, merge=True)

    return callback


async def _run_pipeline_bg(
    pipeline_id: str, payload: PipelineRequest
) -> None:
    callback = _make_progress_callback(pipeline_id)
    try:
        await run_pipeline(
            pipeline_id=pipeline_id,
            file_id=payload.file_id,
            job_input=payload.job_input,
            want_cover_letter=payload.want_cover_letter,
            candidate_email_to_send=payload.candidate_email_to_send,
            progress_callback=callback,
            template_id=payload.template_id,
        )
    except Exception as exc:
        logger.exception("pipeline %s failed", pipeline_id)
        await _doc_ref(pipeline_id).set(
            {
                "overall_status": "failed",
                "error": str(exc),
                "updated_at": _now_iso(),
            },
            merge=True,
        )


async def _run_generation_bg(pipeline_id: str) -> None:
    callback = _make_progress_callback(pipeline_id)
    try:
        await run_generation_phase(pipeline_id=pipeline_id, progress_callback=callback)
    except Exception as exc:
        logger.exception("pipeline %s generation failed", pipeline_id)
        await _doc_ref(pipeline_id).set(
            {
                "overall_status": "failed",
                "error": str(exc),
                "updated_at": _now_iso(),
            },
            merge=True,
        )


@router.post("/start", dependencies=[Depends(pipeline_rate_limit)])
async def start_pipeline(
    payload: PipelineRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    # Verify the resume belongs to the caller before kicking off the pipeline.
    resume_snap = await (
        get_firestore_client()
        .collection(RESUMES_COLLECTION)
        .document(payload.file_id)
        .get()
    )
    if not resume_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="resume not found"
        )
    resume_data = resume_snap.to_dict() or {}
    if resume_data.get("user_id") != user.uid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="resume not found"
        )

    # Prefer the caller-supplied id (lets the frontend navigate to
    # /pipeline/<id> before the round-trip resolves and gives LangSmith a
    # stable thread id). Fall back to a server-side uuid for older clients.
    pipeline_id = (payload.pipeline_id or "").strip() or str(uuid.uuid4())

    # Don't let a client clobber an existing pipeline (its own or someone
    # else's). uuid4 collisions are negligible, but pre-checking is cheap
    # and makes the failure mode loud rather than silent.
    if (await _doc_ref(pipeline_id).get()).exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="pipeline_id already exists",
        )

    await _doc_ref(pipeline_id).set(
        {
            "pipeline_id": pipeline_id,
            "user_id": user.uid,
            "file_id": payload.file_id,
            "overall_status": "started",
            "current_step": None,
            "steps": [],
            "template_id": payload.template_id,
            "started_at": _now_iso(),
            "updated_at": _now_iso(),
        }
    )
    background_tasks.add_task(_run_pipeline_bg, pipeline_id, payload)
    return {"pipeline_id": pipeline_id, "status": "started"}


@router.get("/{pipeline_id}/status", response_model=PipelineProgress)
async def get_status(
    pipeline_id: str,
    user: User = Depends(get_current_user),
) -> PipelineProgress:
    data = await _load_owned_pipeline(pipeline_id, user.uid)
    return PipelineProgress(
        pipeline_id=pipeline_id,
        overall_status=data.get("overall_status", "started"),
        current_step=data.get("current_step"),
        steps=data.get("steps", []),
        error=data.get("error"),
        started_at=data.get("started_at"),
        updated_at=data.get("updated_at"),
        analysis_ended_at=data.get("analysis_ended_at"),
        generation_started_at=data.get("generation_started_at"),
    )


@router.get("/{pipeline_id}/result", response_model=PipelineResult)
async def get_result(
    pipeline_id: str,
    user: User = Depends(get_current_user),
) -> PipelineResult:
    data = await _load_owned_pipeline(pipeline_id, user.uid)
    if data.get("overall_status") != "done":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"pipeline not finished (status={data.get('overall_status')})",
        )
    return PipelineResult(**{k: v for k, v in data.items() if k in PipelineResult.model_fields})


delete_pipeline_rate_limit = rate_limit("pipeline_delete", limit=60, window_seconds=3600)


@router.delete("/{pipeline_id}", dependencies=[Depends(delete_pipeline_rate_limit)])
async def delete_pipeline(
    pipeline_id: str,
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete one pipeline the caller owns: its generated GCS artifacts plus the
    Firestore record. Returns 404 (not 403) for foreign/unknown ids."""
    await _load_owned_pipeline(pipeline_id, user.uid)
    # Remove generated documents (resume.pdf, cover_letter.pdf/docx) first;
    # best-effort so storage hiccups don't block deleting the record.
    await asyncio.to_thread(delete_gcs_prefix, f"pipelines/{pipeline_id}/")
    await _doc_ref(pipeline_id).delete()
    return {"pipeline_id": pipeline_id, "status": "deleted"}


@router.get("/{pipeline_id}/review", response_model=PipelineReview)
async def get_review(
    pipeline_id: str,
    user: User = Depends(get_current_user),
) -> PipelineReview:
    """Proposed tailoring changes for an `awaiting_review` (or finished) pipeline.

    Returns the change checklist the user accepts/rejects before the tailored
    resume is generated. Available once analysis has run; still readable after
    the pipeline finishes so the UI can show what was proposed.
    """
    data = await _load_owned_pipeline(pipeline_id, user.uid)
    if data.get("overall_status") in ("started", "running"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis is not finished yet",
        )
    proposed = data.get("proposed_changes") or []
    original_ats = data.get("original_ats")
    return PipelineReview(
        pipeline_id=pipeline_id,
        proposed_changes=[ProposedChange(**c) for c in proposed if isinstance(c, dict)],
        analyst_summary=data.get("fit_summary"),
        candidate_name=data.get("candidate_name"),
        role_title=data.get("role_title"),
        company_name=data.get("company_name"),
        original_ats=original_ats if isinstance(original_ats, dict) else None,
        template_id=data.get("template_id") or "classic",
    )


apply_changes_rate_limit = rate_limit("pipeline_apply_changes", limit=20, window_seconds=3600)


class ChangeSelection(BaseModel):
    """The user's decision for one proposed change on the review screen."""

    id: str
    accepted: bool = True
    # Which option the user picked ("original" | "opt_N" | "custom"), and the
    # free text when they chose "custom". Optional so a plain accept/reject
    # (changes with no options) still validates.
    option_id: str | None = None
    custom_text: str | None = None
    # For `skills` changes: the skill chips the user kept selected.
    selected_chips: list[str] | None = None


class ApplyChangesRequest(BaseModel):
    # New, per-change selections (accept flag + chosen option). Preferred.
    selections: list[ChangeSelection] | None = None
    # Legacy accept-only list, kept so older clients keep working.
    accepted_ids: list[str] | None = None
    notes: str | None = None
    # Resume PDF template chosen on the review screen. Overrides the doc's
    # template; falls back to the existing value when omitted.
    template_id: ResumeTemplate | None = None


@router.post(
    "/{pipeline_id}/apply-changes",
    dependencies=[Depends(apply_changes_rate_limit)],
)
async def apply_changes(
    pipeline_id: str,
    payload: ApplyChangesRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Accept/reject proposed tailoring changes and resume the pipeline.

    Flips each proposed change's `accepted` flag based on `accepted_ids`,
    optionally appends free-text `notes` to the analyst rewrite instructions,
    sets the doc back to `running`, and kicks off the generation phase.
    """
    data = await _load_owned_pipeline(pipeline_id, user.uid)
    if data.get("overall_status") != "awaiting_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pipeline is not awaiting review (status={data.get('overall_status')})",
        )

    proposed = [c for c in (data.get("proposed_changes") or []) if isinstance(c, dict)]
    if payload.selections is not None:
        by_id = {s.id: s for s in payload.selections}
        for change in proposed:
            sel = by_id.get(change.get("id"))
            if sel is None:
                change["accepted"] = False
                continue
            change["accepted"] = sel.accepted
            if sel.option_id is not None:
                change["selected_option_id"] = sel.option_id
            change["custom_text"] = sel.custom_text
            if sel.selected_chips is not None:
                change["selected_chips"] = sel.selected_chips
    else:
        # Legacy accept-only path.
        accepted = set(payload.accepted_ids or [])
        for change in proposed:
            change["accepted"] = change.get("id") in accepted

    update: dict = {
        "proposed_changes": proposed,
        "overall_status": "running",
        "updated_at": _now_iso(),
        # Anchors the generation-phase clock so the UI timer resumes from the
        # analysis total (review think-time excluded) and survives reloads.
        "generation_started_at": _now_iso(),
    }
    if payload.template_id:
        update["template_id"] = payload.template_id
    if payload.notes and payload.notes.strip():
        analyst_report = dict(data.get("analyst_report") or {})
        instructions = list(analyst_report.get("rewrite_instructions") or [])
        instructions.append(f"USER FEEDBACK: {payload.notes.strip()}")
        analyst_report["rewrite_instructions"] = instructions
        update["analyst_report"] = analyst_report

    await _doc_ref(pipeline_id).set(update, merge=True)
    background_tasks.add_task(_run_generation_bg, pipeline_id)
    return {"pipeline_id": pipeline_id, "status": "running"}


regenerate_rate_limit = rate_limit("pipeline_regenerate", limit=10, window_seconds=3600)


class RegenerateResumeRequest(BaseModel):
    notes: str | None = None


@router.post(
    "/{pipeline_id}/regenerate-resume",
    dependencies=[Depends(regenerate_rate_limit)],
)
async def regenerate_resume(
    pipeline_id: str,
    payload: RegenerateResumeRequest,
    user: User = Depends(get_current_user),
) -> dict:
    """Re-run resume_writer with optional caller-provided feedback notes.

    Loads the stored jd_analysis + analyst_report from the pipeline doc,
    appends `payload.notes` (if any) to `rewrite_instructions`, re-runs the
    writer with ATS feedback loop, rebuilds PDF/DOCX, and updates the
    pipeline doc in place.
    """
    import os
    import tempfile

    data = await _load_owned_pipeline(pipeline_id, user.uid)
    if data.get("overall_status") != "done":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pipeline is not finished yet",
        )

    jd_payload = data.get("jd_analysis")
    if not isinstance(jd_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pipeline missing jd_analysis — cannot regenerate",
        )
    jd_analysis = JDAnalysis(**jd_payload)
    analyst_report = dict(data.get("analyst_report") or {})
    if payload.notes and payload.notes.strip():
        instructions = list(analyst_report.get("rewrite_instructions") or [])
        instructions.append(f"USER FEEDBACK: {payload.notes.strip()}")
        analyst_report["rewrite_instructions"] = instructions

    # Reload original raw resume text from the resume doc.
    file_id = (data.get("file_id") or "").strip()
    raw_resume_text = ""
    if file_id:
        resume_snap = await (
            get_firestore_client()
            .collection(RESUMES_COLLECTION)
            .document(file_id)
            .get()
        )
        raw_resume_text = (resume_snap.to_dict() or {}).get("raw_text", "") if resume_snap.exists else ""

    candidate_name = data.get("candidate_name") or "Candidate"

    template_id = data.get("template_id") or DEFAULT_TEMPLATE
    structured = None
    with pipeline_trace_context(pipeline_id=pipeline_id):
        resume_text, ats_score = await run_resume_writer_with_feedback(
            original_resume_text=raw_resume_text,
            jd_analysis=jd_analysis,
            analyst_report=analyst_report,
            candidate_name=candidate_name,
        )
        try:
            structured = await run_resume_structurer(resume_text, candidate_name)
        except Exception as exc:
            logger.warning(
                "resume structuring failed on regen for %s: %s; using fallback",
                pipeline_id,
                exc,
            )

    tmp_dir = tempfile.mkdtemp(prefix=f"applyai_regen_{pipeline_id}_")
    try:
        pdf_path = os.path.join(tmp_dir, "resume.pdf")
        await build_resume_pdf(
            resume_text,
            pdf_path,
            template_id=template_id,
            structured=structured,
            candidate_name=candidate_name,
        )
        pdf_url = upload_document_to_gcs(pdf_path, f"pipelines/{pipeline_id}/resume.pdf")
    finally:
        try:
            for name in os.listdir(tmp_dir):
                os.remove(os.path.join(tmp_dir, name))
            os.rmdir(tmp_dir)
        except OSError:
            logger.debug("temp cleanup failed for %s", tmp_dir, exc_info=True)

    await _doc_ref(pipeline_id).set(
        {
            "resume_pdf_url": pdf_url,
            "ats_score": ats_score,
            "analyst_report": analyst_report,
            "updated_at": _now_iso(),
        },
        merge=True,
    )
    return {
        "resume_pdf_url": pdf_url,
        "ats_score": ats_score,
    }


interview_prep_rate_limit = rate_limit(
    "interview_prep", limit=15, window_seconds=3600
)


@router.post(
    "/{pipeline_id}/interview-prep",
    response_model=InterviewPrep,
    dependencies=[Depends(interview_prep_rate_limit)],
)
async def interview_prep(
    pipeline_id: str,
    user: User = Depends(get_current_user),
) -> InterviewPrep:
    """Generate an interview prep packet for a finished pipeline.

    Cached on the pipeline doc — subsequent calls return the stored packet
    without re-invoking the agent.
    """
    data = await _load_owned_pipeline(pipeline_id, user.uid)
    if data.get("overall_status") != "done":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pipeline is not finished yet",
        )

    cached = data.get("interview_prep")
    if isinstance(cached, dict) and cached:
        return InterviewPrep(**cached)

    jd_payload = data.get("jd_analysis")
    if not isinstance(jd_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pipeline missing jd_analysis",
        )
    jd_analysis = JDAnalysis(**jd_payload)

    # Reload the parsed resume from the resume doc.
    file_id = (data.get("file_id") or "").strip()
    parsed_resume = ParsedResume()
    if file_id:
        snap = await (
            get_firestore_client()
            .collection(RESUMES_COLLECTION)
            .document(file_id)
            .get()
        )
        if snap.exists:
            parsed = (snap.to_dict() or {}).get("parsed") or {}
            if isinstance(parsed, dict) and parsed:
                parsed_resume = ParsedResume(**parsed)

    # Run under the pipeline's trace context so the LangSmith trace groups
    # into the same thread (session_id) as the pipeline's other agents.
    with pipeline_trace_context(pipeline_id=pipeline_id):
        prep = await run_interview_prep(parsed_resume, jd_analysis)

    await _doc_ref(pipeline_id).set(
        {
            "interview_prep": prep.model_dump(mode="json"),
            "updated_at": _now_iso(),
        },
        merge=True,
    )
    return prep


async def _finished_pipeline_with_jd(
    pipeline_id: str, uid: str
) -> tuple[dict, JDAnalysis]:
    """Shared loader for the on-demand analysis endpoints: require a finished
    pipeline and return (doc_data, parsed JDAnalysis)."""
    data = await _load_owned_pipeline(pipeline_id, uid)
    if data.get("overall_status") != "done":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pipeline is not finished yet",
        )
    jd_payload = data.get("jd_analysis")
    if not isinstance(jd_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pipeline missing jd_analysis",
        )
    return data, JDAnalysis(**jd_payload)


skill_roadmap_rate_limit = rate_limit("skill_roadmap", limit=15, window_seconds=3600)


@router.post(
    "/{pipeline_id}/skill-roadmap",
    response_model=SkillRoadmap,
    dependencies=[Depends(skill_roadmap_rate_limit)],
)
async def skill_roadmap(
    pipeline_id: str,
    user: User = Depends(get_current_user),
) -> SkillRoadmap:
    """Skill-gap analysis + learning roadmap for a finished pipeline. Cached."""
    data, jd_analysis = await _finished_pipeline_with_jd(pipeline_id, user.uid)
    cached = data.get("skill_roadmap")
    if isinstance(cached, dict) and cached:
        return SkillRoadmap(**cached)

    analyst_report = dict(data.get("analyst_report") or {})
    # Reload the candidate's real skills from the resume doc.
    candidate_skills: list[str] = []
    file_id = (data.get("file_id") or "").strip()
    if file_id:
        snap = await (
            get_firestore_client()
            .collection(RESUMES_COLLECTION)
            .document(file_id)
            .get()
        )
        if snap.exists:
            parsed = (snap.to_dict() or {}).get("parsed") or {}
            if isinstance(parsed, dict):
                candidate_skills = parsed.get("skills") or []

    with pipeline_trace_context(pipeline_id=pipeline_id):
        result = await run_skill_roadmap(jd_analysis, analyst_report, candidate_skills)
    await _doc_ref(pipeline_id).set(
        {"skill_roadmap": result.model_dump(mode="json"), "updated_at": _now_iso()},
        merge=True,
    )
    return result


recruiter_review_rate_limit = rate_limit(
    "recruiter_review", limit=15, window_seconds=3600
)


@router.post(
    "/{pipeline_id}/recruiter-review",
    response_model=RecruiterReview,
    dependencies=[Depends(recruiter_review_rate_limit)],
)
async def recruiter_review(
    pipeline_id: str,
    user: User = Depends(get_current_user),
) -> RecruiterReview:
    """Recruiter-perspective review of the tailored resume. Cached."""
    data, jd_analysis = await _finished_pipeline_with_jd(pipeline_id, user.uid)
    cached = data.get("recruiter_review")
    if isinstance(cached, dict) and cached:
        return RecruiterReview(**cached)

    resume_text = data.get("resume_text") or ""
    with pipeline_trace_context(pipeline_id=pipeline_id):
        result = await run_recruiter_review(resume_text, jd_analysis)
    await _doc_ref(pipeline_id).set(
        {"recruiter_review": result.model_dump(mode="json"), "updated_at": _now_iso()},
        merge=True,
    )
    return result


resume_risks_rate_limit = rate_limit("resume_risks", limit=15, window_seconds=3600)


@router.post(
    "/{pipeline_id}/resume-risks",
    response_model=ResumeRisks,
    dependencies=[Depends(resume_risks_rate_limit)],
)
async def resume_risks(
    pipeline_id: str,
    user: User = Depends(get_current_user),
) -> ResumeRisks:
    """Resume risk detector — weak spots + honest fixes. Cached."""
    data, jd_analysis = await _finished_pipeline_with_jd(pipeline_id, user.uid)
    cached = data.get("resume_risks")
    if isinstance(cached, dict) and cached:
        return ResumeRisks(**cached)

    resume_text = data.get("resume_text") or ""
    with pipeline_trace_context(pipeline_id=pipeline_id):
        result = await run_resume_risks(resume_text, jd_analysis)
    await _doc_ref(pipeline_id).set(
        {"resume_risks": result.model_dump(mode="json"), "updated_at": _now_iso()},
        merge=True,
    )
    return result


_EXPORT_PATHS = {
    "pdf": "resume.pdf",
    "cover_pdf": "cover_letter.pdf",
    "cover_docx": "cover_letter.docx",
}


@router.get("/{pipeline_id}/export")
async def export_document(
    pipeline_id: str,
    format: str = Query(..., pattern="^(pdf|cover_pdf|cover_docx)$"),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Return a fresh signed URL for the requested document.

    The orchestrator already uploads
    `pipelines/{id}/{resume.pdf|cover_letter.pdf|cover_letter.docx}`
    to GCS, so we just re-sign the existing object. Useful when the original
    7-day signed URL has expired.
    """
    data = await _load_owned_pipeline(pipeline_id, user.uid)
    if format in ("cover_pdf", "cover_docx") and not data.get(
        "cover_letter_pdf_url"
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cover letter was generated for this pipeline",
        )
    gcs_path = f"pipelines/{pipeline_id}/{_EXPORT_PATHS[format]}"
    return {"url": fresh_signed_url(gcs_path), "filename": _EXPORT_PATHS[format]}


@router.get("/{pipeline_id}/stream")
async def stream_pipeline(
    pipeline_id: str,
    access_token: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
) -> StreamingResponse:
    # EventSource can't set headers, so the SSE endpoint also accepts the token
    # via ?access_token=<token>. Prefer the Authorization header if present.
    bearer = authorization if authorization else (
        f"Bearer {access_token}" if access_token else None
    )
    user = await get_current_user(bearer)

    # Verify ownership up-front so we don't open a stream to a foreign pipeline.
    await _load_owned_pipeline(pipeline_id, user.uid)

    async def event_source() -> AsyncGenerator[str, None]:
        seen: dict[str, str] = {}
        polls = 0
        while polls < STREAM_MAX_POLLS:
            polls += 1
            snapshot = await _doc_ref(pipeline_id).get()
            if not snapshot.exists:
                yield f"data: {json.dumps({'error': 'not_found'})}\n\n"
                return
            data = snapshot.to_dict() or {}

            for step in data.get("steps", []):
                if seen.get(step.get("name")) != step.get("state"):
                    seen[step.get("name")] = step.get("state")
                    yield f"data: {json.dumps(step, default=str)}\n\n"

            overall = data.get("overall_status")
            if overall in ("done", "failed"):
                yield (
                    "event: end\n"
                    f"data: {json.dumps({'overall_status': overall, 'error': data.get('error')})}\n\n"
                )
                return

            await asyncio.sleep(POLL_INTERVAL_SECONDS)

        yield "event: end\ndata: {\"overall_status\": \"timeout\"}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

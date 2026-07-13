"""Coordinator that runs the full ApplyAI agent pipeline end-to-end.

This is intentionally not an ADK agent itself — it's a Python async function
that sequences the individual ADK agents and tools.

The pipeline runs in two phases so a human can review proposed tailoring
changes before the final resume is written:

  analysis phase   jd_scraper → jd_parser → resume_loader → resume_analyst
                   → ats(original); builds proposed_changes; persists them.
  generation phase resume_writer → ats(tailored) → document_builder
                   → cover_letter? → email_drafter?

`run_pipeline` stops after analysis at `overall_status="awaiting_review"`.
`run_generation_phase` is kicked off later by the apply-changes endpoint once
the user has accepted/rejected changes.
"""
from __future__ import annotations

import copy
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Awaitable, Callable

from app.agents._tracing import pipeline_trace_context
from app.agents.ats_scorer import run_ats_scorer
from app.agents.cover_letter import run_cover_letter_agent
from app.agents.email_drafter import run_email_drafter
from app.agents.interview_prep import run_interview_prep
from app.agents.jd_parser import run_jd_parser
from app.agents.resume_analyst import run_resume_analyst
from app.agents.resume_structurer import run_resume_structurer
from app.agents.resume_writer import run_resume_writer_with_feedback
from app.agents.skill_roadmap import run_skill_roadmap
from app.core.gcp import get_firestore_client
from app.schemas.ats import AtsAnalysis
from app.schemas.jd import JDAnalysis
from app.schemas.pipeline import (
    AgentStatus,
    EmailDraftPayload,
    JobInputRequest,
    PipelineResult,
)
from app.schemas.resume import ParsedResume
from app.tools.document_builder import (
    build_cover_letter_docx,
    build_cover_letter_pdf,
    build_resume_pdf,
    upload_document_to_gcs,
)
from app.tools.gmail import build_gmail_compose_url
from app.tools.resume_render import DEFAULT_TEMPLATE, build_structured_resume
from app.tools.scraper import scrape_jd

logger = logging.getLogger(__name__)

PIPELINES_COLLECTION = "pipelines"
RESUMES_COLLECTION = "resumes"

ChangeCategories = ("summary", "skills", "experience", "projects", "keywords")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: object) -> datetime | None:
    """Parse an ISO-8601 timestamp (as written by ``_now().isoformat()``).

    Returns ``None`` for missing/garbage input so duration math degrades to a
    skipped measurement rather than raising.
    """
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _doc_ref(pipeline_id: str):
    return get_firestore_client().collection(PIPELINES_COLLECTION).document(pipeline_id)


async def _load_resume(file_id: str) -> tuple[ParsedResume, str, dict]:
    snapshot = await (
        get_firestore_client()
        .collection(RESUMES_COLLECTION)
        .document(file_id)
        .get()
    )
    if not snapshot.exists:
        raise ValueError(f"resume {file_id} not found")
    data = snapshot.to_dict() or {}
    raw_text = data.get("raw_text", "") or ""

    parsed_payload = data.get("parsed")
    if isinstance(parsed_payload, dict) and parsed_payload:
        parsed_resume = ParsedResume(**parsed_payload)
    else:
        parsed_resume = ParsedResume(summary=raw_text)
    return parsed_resume, raw_text, data


def _original_resume_signed_url(resume_doc: dict) -> tuple[str | None, str | None]:
    """Re-sign the originally-uploaded resume blob and return (url, filename).

    The upload endpoint stores the resume at gs://<bucket>/resumes/<file_id>/<filename>;
    here we recover that path from the persisted gcs_url and issue a fresh
    v4 signed GET URL for the preview panel.
    """
    from urllib.parse import unquote

    from app.tools.document_builder import fresh_signed_url

    gcs_url = (resume_doc.get("gcs_url") or "").strip()
    if not gcs_url.startswith("gs://"):
        return None, None
    # gs://bucket/resumes/<file_id>/<filename>
    rest = gcs_url[len("gs://") :]
    parts = rest.split("/", 1)
    if len(parts) != 2:
        return None, None
    blob_path = parts[1]
    filename = unquote(blob_path.rsplit("/", 1)[-1])
    try:
        url = fresh_signed_url(blob_path)
    except Exception:
        logger.warning("failed to sign original resume url for %s", blob_path, exc_info=True)
        return None, filename
    return url, filename


def _build_fit_summary(analyst_report: dict) -> str:
    matching = ", ".join(analyst_report.get("matching_skills", []) or [])
    transferable = "; ".join(analyst_report.get("transferable_experiences", []) or [])
    parts: list[str] = []
    if matching:
        parts.append(f"Matching skills: {matching}")
    if transferable:
        parts.append(f"Transferable experience: {transferable}")
    return "\n".join(parts) or "Strong candidate fit based on resume analysis."


def _build_proposed_changes(analyst_report: dict) -> list[dict]:
    """Normalise the analyst's proposed_changes into reviewable items.

    The resume_analyst prompt emits a `proposed_changes` array; if it's present
    and well-formed we use it directly, otherwise we synthesise a minimal list
    from rewrite_instructions so the review screen is never empty.
    """
    raw = analyst_report.get("proposed_changes")
    changes: list[dict] = []
    if isinstance(raw, list):
        for i, item in enumerate(raw, start=1):
            if not isinstance(item, dict):
                continue
            category = item.get("category")
            if category not in ChangeCategories:
                category = "experience"
            before = item.get("before")
            options = _build_change_options(item, before)
            chips = (
                _build_skill_chips(item, analyst_report)
                if category == "skills"
                else []
            )
            changes.append(
                {
                    "id": str(item.get("id") or f"chg_{i}"),
                    "category": category,
                    "title": str(item.get("title") or "Tailoring change"),
                    "detail": str(item.get("detail") or ""),
                    "before": before,
                    # Mirror the first AI option into `after` for back-compat.
                    "after": next(
                        (o["text"] for o in options if o["kind"] == "ai"),
                        item.get("after"),
                    ),
                    "options": options,
                    # Default to the first AI rewrite so an un-touched change
                    # still applies a tailored option.
                    "selected_option_id": next(
                        (o["id"] for o in options if o["kind"] == "ai"), None
                    ),
                    "custom_text": None,
                    "chips": chips,
                    # Pre-select every suggested chip — they're all genuine.
                    "selected_chips": list(chips) if chips else None,
                    "accepted": bool(item.get("accepted", True)),
                }
            )
    if not changes:
        for i, instr in enumerate(analyst_report.get("rewrite_instructions") or [], start=1):
            changes.append(
                {
                    "id": f"chg_{i}",
                    "category": "experience",
                    "title": str(instr)[:80],
                    "detail": str(instr),
                    "before": None,
                    "after": None,
                    "options": [],
                    "selected_option_id": None,
                    "custom_text": None,
                    "accepted": True,
                }
            )
    return changes


def _build_change_options(item: dict, before: str | None) -> list[dict]:
    """Build the radio choices for one proposed change.

    Order: keep-original (when there's existing text), the analyst's AI
    rewrites, then a write-your-own placeholder. Each option carries a stable
    id the apply-changes endpoint references when recording the user's pick.
    """
    options: list[dict] = []
    if before and str(before).strip():
        options.append(
            {
                "id": "original",
                "label": "Keep original",
                "text": str(before).strip(),
                "kind": "original",
            }
        )
    raw_options = item.get("options")
    if isinstance(raw_options, list):
        for j, opt in enumerate(raw_options, start=1):
            if not isinstance(opt, dict):
                continue
            text = str(opt.get("text") or "").strip()
            if not text:
                continue
            options.append(
                {
                    "id": f"opt_{j}",
                    "label": str(opt.get("label") or f"Option {j}"),
                    "text": text,
                    "kind": "ai",
                }
            )
    # Fallback: synthesise a single AI option from a legacy `after` snippet.
    if not any(o["kind"] == "ai" for o in options):
        after = str(item.get("after") or "").strip()
        if after:
            options.append(
                {"id": "opt_1", "label": "Suggested", "text": after, "kind": "ai"}
            )
    if options:
        options.append(
            {"id": "custom", "label": "Write my own", "text": "", "kind": "custom"}
        )
    return options


def _build_skill_chips(item: dict, analyst_report: dict) -> list[str]:
    """Individual, clickable skill tokens for a `skills` proposed change.

    Prefers the analyst's per-change `chips`, falls back to the report-level
    `matching_skills` (JD-relevant skills the candidate genuinely has). Skills
    are deduped case-insensitively while preserving first-seen order so the
    chip row is stable.
    """
    raw: list = []
    if isinstance(item.get("chips"), list):
        raw.extend(item["chips"])
    if not raw and isinstance(analyst_report.get("matching_skills"), list):
        raw.extend(analyst_report["matching_skills"])
    seen: set[str] = set()
    chips: list[str] = []
    for skill in raw:
        token = str(skill).strip()
        key = token.lower()
        if token and key not in seen:
            seen.add(key)
            chips.append(token)
    return chips


def _report_with_accepted_changes(analyst_report: dict, proposed_changes: list[dict]) -> dict:
    """Filter proposed_changes to accepted ones and fold them into
    rewrite_instructions so the writer applies exactly what the user approved."""
    report = copy.deepcopy(analyst_report)
    accepted = [c for c in proposed_changes if c.get("accepted", True)]
    report["proposed_changes"] = accepted
    instructions = list(report.get("rewrite_instructions") or [])
    for c in accepted:
        title = (c.get("title") or "").strip()
        detail = (c.get("detail") or "").strip()
        # Skills changes carry clickable chips instead of full-text options.
        if c.get("category") == "skills" and c.get("chips"):
            picked = c.get("selected_chips")
            picked = picked if isinstance(picked, list) else c.get("chips")
            picked = [str(s).strip() for s in picked if str(s).strip()]
            if picked:
                instructions.append(
                    "Surface these JD-relevant skills the candidate already has, "
                    "grouped clearly in the skills section: " + ", ".join(picked)
                )
            continue
        chosen_kind, chosen_text = _resolve_selected_option(c)
        if chosen_kind == "original":
            # User wants to keep their existing wording for this part —
            # tell the writer to leave it untouched rather than rephrase.
            keep = chosen_text or (c.get("before") or "").strip()
            line = f"Keep the existing {c.get('category', 'resume')} wording unchanged"
            if keep:
                line += f": \"{keep}\""
            instructions.append(line)
        elif chosen_text:
            # Use the user-selected (or user-typed) wording verbatim.
            header = f"{title}: " if title else ""
            instructions.append(
                f"{header}use this exact wording verbatim — \"{chosen_text}\""
            )
        else:
            line = f"{title}: {detail}".strip(": ").strip()
            if line:
                instructions.append(line)
    report["rewrite_instructions"] = instructions
    return report


def _resolve_selected_option(change: dict) -> tuple[str | None, str]:
    """Return the (kind, text) of the option the user picked for a change.

    Falls back to the default AI option, then to legacy `after`, so a change
    coming from an old doc (no options) still yields usable writer guidance.
    """
    options = change.get("options") or []
    selected_id = change.get("selected_option_id")
    if selected_id == "custom":
        return "custom", (change.get("custom_text") or "").strip()
    chosen = next((o for o in options if o.get("id") == selected_id), None)
    if chosen is None:
        chosen = next((o for o in options if o.get("kind") == "ai"), None)
    if chosen is not None:
        return chosen.get("kind"), (chosen.get("text") or "").strip()
    return None, (change.get("after") or "").strip()


def _make_step_helpers(
    progress_callback: Callable[[AgentStatus], Awaitable[None]],
):
    async def step(name: str) -> datetime:
        started = _now()
        await progress_callback(AgentStatus(name=name, state="running", started_at=started))
        return started

    async def step_done(name: str, started: datetime, message: str | None = None) -> None:
        await progress_callback(
            AgentStatus(
                name=name,
                state="done",
                started_at=started,
                ended_at=_now(),
                message=message,
            )
        )

    async def step_skipped(name: str, message: str) -> None:
        now = _now()
        await progress_callback(
            AgentStatus(
                name=name,
                state="skipped",
                started_at=now,
                ended_at=now,
                message=message,
            )
        )

    return step, step_done, step_skipped


# --- Phase 1: analysis -------------------------------------------------------


async def _run_analysis_phase(
    pipeline_id: str,
    file_id: str,
    job_input: JobInputRequest,
    want_cover_letter: bool,
    candidate_email_to_send: str | None,
    progress_callback: Callable[[AgentStatus], Awaitable[None]],
    template_id: str = DEFAULT_TEMPLATE,
) -> dict:
    """Run scrape → parse → load → analyse → score(original). Returns a dict of
    everything the generation phase needs, and persists it onto the doc."""
    step, step_done, _ = _make_step_helpers(progress_callback)

    # 1. JD scraping
    started = await step("jd_scraper")
    if job_input.url:
        jd_text = await scrape_jd(str(job_input.url))
        if not jd_text:
            await progress_callback(
                AgentStatus(
                    name="jd_scraper",
                    state="failed",
                    started_at=started,
                    ended_at=_now(),
                    message="scrape_failed",
                )
            )
            raise ValueError("scrape_failed")
    else:
        jd_text = (job_input.raw_jd or "").strip()
        if not jd_text:
            raise ValueError("missing_jd")
    await step_done("jd_scraper", started, f"{len(jd_text)} chars")

    # 2. JD parser
    started = await step("jd_parser")
    jd_analysis: JDAnalysis = await run_jd_parser(
        jd_text,
        company_hint=job_input.company_name,
        role_hint=job_input.role_title,
    )
    await step_done("jd_parser", started, jd_analysis.role_title)

    # 3. Resume loader
    started = await step("resume_loader")
    parsed_resume, raw_resume_text, resume_doc = await _load_resume(file_id)
    original_resume_url, original_resume_filename = _original_resume_signed_url(
        resume_doc
    )
    original_resume_file_type = resume_doc.get("file_type")
    await step_done("resume_loader", started)

    # 4. Resume analyst
    started = await step("resume_analyst")
    analyst_report = await run_resume_analyst(parsed_resume, jd_analysis)
    candidate_name = (
        analyst_report.get("candidate_name")
        or parsed_resume.candidate_name
        or "Candidate"
    )
    proposed_changes = _build_proposed_changes(analyst_report)
    await step_done("resume_analyst", started, candidate_name)

    # 4b. ATS analyst — score the ORIGINAL resume now (the tailored score comes
    # in the generation phase). Non-fatal.
    started = await step("ats_analyst")
    original_ats: AtsAnalysis | None = None
    try:
        original_ats = await run_ats_scorer(raw_resume_text, jd_analysis)
        await step_done("ats_analyst", started, f"original={original_ats.score}")
    except Exception as exc:
        logger.warning("ats(original) failed for pipeline %s: %s", pipeline_id, exc)
        await progress_callback(
            AgentStatus(
                name="ats_analyst",
                state="skipped",
                started_at=started,
                ended_at=_now(),
                message=f"failed: {exc}",
            )
        )

    fit_summary = _build_fit_summary(analyst_report)
    analysis = {
        "jd_text": jd_text,
        "jd_analysis": jd_analysis,
        "analyst_report": analyst_report,
        "proposed_changes": proposed_changes,
        "candidate_name": candidate_name,
        "role_title": jd_analysis.role_title,
        "company_name": jd_analysis.company_name,
        "fit_summary": fit_summary,
        "original_ats": original_ats,
        "parsed_resume": parsed_resume,
        "raw_resume_text": raw_resume_text,
        "original_resume_url": original_resume_url,
        "original_resume_filename": original_resume_filename,
        "original_resume_file_type": original_resume_file_type,
        "file_id": file_id,
        "want_cover_letter": want_cover_letter,
        "candidate_email_to_send": candidate_email_to_send,
        "template_id": template_id,
    }

    # Persist analysis output so the generation phase (a separate task) can read
    # it after the user reviews the proposed changes.
    await _doc_ref(pipeline_id).set(
        {
            "jd_text": jd_text,
            "jd_analysis": jd_analysis.model_dump(mode="json"),
            "analyst_report": analyst_report,
            "proposed_changes": proposed_changes,
            "candidate_name": candidate_name,
            "role_title": jd_analysis.role_title,
            "company_name": jd_analysis.company_name,
            "fit_summary": fit_summary,
            "original_ats": original_ats.model_dump(mode="json") if original_ats else None,
            "original_resume_text": raw_resume_text,
            "original_resume_url": original_resume_url,
            "original_resume_filename": original_resume_filename,
            "original_resume_file_type": original_resume_file_type,
            "want_cover_letter": want_cover_letter,
            "candidate_email_to_send": candidate_email_to_send,
            "template_id": template_id,
            "updated_at": _now().isoformat(),
        },
        merge=True,
    )
    return analysis


# --- Phase 2: generation -----------------------------------------------------


async def _run_generation_phase(
    pipeline_id: str,
    analysis: dict,
    accepted_report: dict,
    progress_callback: Callable[[AgentStatus], Awaitable[None]],
) -> PipelineResult:
    """Run writer → ats(tailored) → docs → cover? → email? and persist `done`."""
    step, step_done, step_skipped = _make_step_helpers(progress_callback)
    # Prefer the anchor persisted by apply-changes so the final figure matches
    # the live UI clock; fall back to "now" for direct invocations.
    generation_started = (
        _parse_iso(analysis.get("generation_started_at")) or _now()
    )

    jd_analysis: JDAnalysis = analysis["jd_analysis"]
    candidate_name: str = analysis["candidate_name"]
    raw_resume_text: str = analysis["raw_resume_text"]
    parsed_resume: ParsedResume = analysis["parsed_resume"]
    original_ats: AtsAnalysis | None = analysis.get("original_ats")
    want_cover_letter: bool = analysis.get("want_cover_letter", False)
    candidate_email_to_send: str | None = analysis.get("candidate_email_to_send")

    # 5. Resume writer (with ATS feedback loop), using only accepted changes.
    started = await step("resume_writer")
    resume_text, ats_result = await run_resume_writer_with_feedback(
        original_resume_text=raw_resume_text,
        jd_analysis=jd_analysis,
        analyst_report=accepted_report,
        candidate_name=candidate_name,
    )
    await step_done(
        "resume_writer",
        started,
        f"ATS final_score={ats_result.get('final_score')}",
    )

    # 5b. Score the tailored resume (the original was scored in analysis).
    started = await step("ats_tailored")
    tailored_ats: AtsAnalysis | None = None
    try:
        tailored_ats = await run_ats_scorer(resume_text, jd_analysis)
        await step_done("ats_tailored", started, f"tailored={tailored_ats.score}")
    except Exception as exc:
        logger.warning("ats(tailored) failed for pipeline %s: %s", pipeline_id, exc)
        await progress_callback(
            AgentStatus(
                name="ats_tailored",
                state="skipped",
                started_at=started,
                ended_at=_now(),
                message=f"failed: {exc}",
            )
        )

    # 6. Document builder. Structure the tailored text for rich template
    # rendering (non-fatal — the PDF builder falls back to a deterministic
    # parse of the same text if the structurer agent fails).
    started = await step("document_builder")
    template_id = analysis.get("template_id") or DEFAULT_TEMPLATE
    structured = None
    try:
        structured = await run_resume_structurer(resume_text, candidate_name)
    except Exception as exc:
        logger.warning(
            "resume structuring failed for %s: %s; using fallback parser",
            pipeline_id,
            exc,
        )
    if structured is None:
        structured = build_structured_resume(resume_text, candidate_name)
    tmp_dir = tempfile.mkdtemp(prefix=f"applyai_{pipeline_id}_")
    try:
        pdf_path = os.path.join(tmp_dir, "resume.pdf")
        await build_resume_pdf(
            resume_text,
            pdf_path,
            template_id=template_id,
            structured=structured,
            candidate_name=candidate_name,
        )
        resume_pdf_url = upload_document_to_gcs(
            pdf_path, f"pipelines/{pipeline_id}/resume.pdf"
        )
        await step_done("document_builder", started)

        # 7. Cover letter
        cover_letter_pdf_url: str | None = None
        cover_letter_docx_url: str | None = None
        if want_cover_letter:
            cl_started = await step("cover_letter")
            resume_summary = parsed_resume.summary or raw_resume_text
            cover_letter_text = await run_cover_letter_agent(
                resume_summary=resume_summary,
                jd_analysis=jd_analysis,
                candidate_name=candidate_name,
            )
            cover_pdf_path = os.path.join(tmp_dir, "cover_letter.pdf")
            await build_cover_letter_pdf(
                cover_letter_text=cover_letter_text,
                candidate_name=candidate_name,
                role_title=jd_analysis.role_title,
                company_name=jd_analysis.company_name,
                output_path=cover_pdf_path,
                links=structured.links,
                location=structured.location,
                headline=structured.headline,
            )
            cover_letter_pdf_url = upload_document_to_gcs(
                cover_pdf_path,
                f"pipelines/{pipeline_id}/cover_letter.pdf",
            )
            cover_docx_path = os.path.join(tmp_dir, "cover_letter.docx")
            build_cover_letter_docx(
                cover_letter_text=cover_letter_text,
                candidate_name=candidate_name,
                role_title=jd_analysis.role_title,
                company_name=jd_analysis.company_name,
                output_path=cover_docx_path,
                links=structured.links,
                location=structured.location,
                headline=structured.headline,
            )
            cover_letter_docx_url = upload_document_to_gcs(
                cover_docx_path,
                f"pipelines/{pipeline_id}/cover_letter.docx",
            )
            await step_done("cover_letter", cl_started)
        else:
            await step_skipped("cover_letter", "want_cover_letter=false")

        # 8. Email drafter
        email_draft: EmailDraftPayload | None = None
        if candidate_email_to_send:
            em_started = await step("email_drafter")
            fit_summary = _build_fit_summary(accepted_report)
            draft = await run_email_drafter(
                candidate_name=candidate_name,
                role_title=jd_analysis.role_title,
                company_name=jd_analysis.company_name,
                fit_summary=fit_summary,
            )
            gmail_url = build_gmail_compose_url(
                to_email=candidate_email_to_send,
                subject=draft["subject"],
                body=draft["body"],
            )
            email_draft = EmailDraftPayload(
                subject=draft["subject"],
                body=draft["body"],
                to=candidate_email_to_send,
                gmail_url=gmail_url,
            )
            await step_done("email_drafter", em_started)
        else:
            await step_skipped("email_drafter", "no recipient provided")

    finally:
        # Clean up temp files; ignore errors so they don't mask a real failure
        try:
            for name in os.listdir(tmp_dir):
                os.remove(os.path.join(tmp_dir, name))
            os.rmdir(tmp_dir)
        except OSError:
            logger.debug("temp cleanup failed for %s", tmp_dir, exc_info=True)

    # 9. Pre-compute the always-on insight tabs (interview prep + skill roadmap)
    # so they're already populated when the user opens those tabs instead of
    # showing an empty "Generate" state. Both are non-fatal — a failure just
    # leaves the tab to generate on demand.
    interview_prep_payload: dict | None = None
    ip_started = await step("interview_prep")
    try:
        prep = await run_interview_prep(parsed_resume, jd_analysis)
        interview_prep_payload = prep.model_dump(mode="json")
        await step_done("interview_prep", ip_started)
    except Exception as exc:
        logger.warning("interview_prep failed for pipeline %s: %s", pipeline_id, exc)
        await step_skipped("interview_prep", f"failed: {exc}")

    skill_roadmap_payload: dict | None = None
    sr_started = await step("skill_roadmap")
    try:
        roadmap = await run_skill_roadmap(
            jd_analysis, accepted_report, parsed_resume.skills
        )
        skill_roadmap_payload = roadmap.model_dump(mode="json")
        await step_done("skill_roadmap", sr_started)
    except Exception as exc:
        logger.warning("skill_roadmap failed for pipeline %s: %s", pipeline_id, exc)
        await step_skipped("skill_roadmap", f"failed: {exc}")

    completed = _now()
    # Total active processing time = analysis-phase compute + generation-phase
    # compute, deliberately excluding the human review pause in between. Falls
    # back to None if the timing anchors are missing (old/partial docs).
    analysis_started = _parse_iso(analysis.get("started_at"))
    analysis_ended = _parse_iso(analysis.get("analysis_ended_at"))
    duration_seconds: int | None = None
    generation_seconds = (completed - generation_started).total_seconds()
    if analysis_started and analysis_ended:
        analysis_seconds = (analysis_ended - analysis_started).total_seconds()
        duration_seconds = round(max(0.0, analysis_seconds + generation_seconds))
    else:
        duration_seconds = round(max(0.0, generation_seconds))

    result = PipelineResult(
        pipeline_id=pipeline_id,
        candidate_name=candidate_name,
        role_title=jd_analysis.role_title,
        company_name=jd_analysis.company_name,
        fit_summary=_build_fit_summary(accepted_report),
        jd_analysis=jd_analysis,
        analyst_report=accepted_report,
        resume_pdf_url=resume_pdf_url,
        template_id=template_id,
        cover_letter_pdf_url=cover_letter_pdf_url,
        cover_letter_docx_url=cover_letter_docx_url,
        email_draft=email_draft,
        ats_score=ats_result,
        original_ats=original_ats,
        tailored_ats=tailored_ats,
        completed_at=completed,
        duration_seconds=duration_seconds,
        original_resume_text=raw_resume_text,
        resume_text=resume_text,
        original_resume_url=analysis.get("original_resume_url"),
        original_resume_filename=analysis.get("original_resume_filename"),
        original_resume_file_type=analysis.get("original_resume_file_type"),
        jd_text=analysis.get("jd_text"),
    )

    final_doc: dict = {
        **result.model_dump(mode="json"),
        "proposed_changes": accepted_report.get("proposed_changes", []),
        "overall_status": "done",
        "current_step": None,
        "updated_at": _now().isoformat(),
    }
    if interview_prep_payload is not None:
        final_doc["interview_prep"] = interview_prep_payload
    if skill_roadmap_payload is not None:
        final_doc["skill_roadmap"] = skill_roadmap_payload
    await _doc_ref(pipeline_id).set(final_doc, merge=True)
    return result


# --- public entry points -----------------------------------------------------


async def run_pipeline(
    pipeline_id: str,
    file_id: str,
    job_input: JobInputRequest,
    want_cover_letter: bool,
    candidate_email_to_send: str | None,
    progress_callback: Callable[[AgentStatus], Awaitable[None]],
    template_id: str = DEFAULT_TEMPLATE,
) -> None:
    """Run the analysis phase, persist proposed changes, and mark the doc
    `awaiting_review`. The generation phase is kicked off later by the
    apply-changes endpoint once the user accepts/rejects changes.
    """
    with pipeline_trace_context(pipeline_id=pipeline_id):
        await _run_analysis_phase(
            pipeline_id=pipeline_id,
            file_id=file_id,
            job_input=job_input,
            want_cover_letter=want_cover_letter,
            candidate_email_to_send=candidate_email_to_send,
            progress_callback=progress_callback,
            template_id=template_id,
        )
        now_iso = _now().isoformat()
        await _doc_ref(pipeline_id).set(
            {
                "overall_status": "awaiting_review",
                "current_step": None,
                # Bookends the analysis-phase compute so the human review pause
                # is excluded from the reported processing time.
                "analysis_ended_at": now_iso,
                "updated_at": now_iso,
            },
            merge=True,
        )


async def run_generation_phase(
    pipeline_id: str,
    progress_callback: Callable[[AgentStatus], Awaitable[None]],
) -> PipelineResult:
    """Resume an `awaiting_review` pipeline after the user has accepted/rejected
    changes. Reconstructs the analysis state from the persisted doc."""
    with pipeline_trace_context(pipeline_id=pipeline_id):
        snapshot = await _doc_ref(pipeline_id).get()
        data = snapshot.to_dict() or {}

        jd_payload = data.get("jd_analysis") or {}
        jd_analysis = JDAnalysis(**jd_payload)
        analyst_report = dict(data.get("analyst_report") or {})
        proposed_changes = list(data.get("proposed_changes") or [])
        original_ats_payload = data.get("original_ats")
        original_ats = (
            AtsAnalysis(**original_ats_payload)
            if isinstance(original_ats_payload, dict)
            else None
        )

        # parsed_resume is reloaded from the resume doc for the cover-letter
        # summary; fall back to the persisted original text.
        file_id = (data.get("file_id") or "").strip()
        raw_resume_text = data.get("original_resume_text", "") or ""
        parsed_resume = ParsedResume(summary=raw_resume_text)
        if file_id:
            try:
                parsed_resume, raw_resume_text, _ = await _load_resume(file_id)
            except ValueError:
                logger.warning("resume %s missing on regen; using stored text", file_id)

        analysis = {
            "jd_text": data.get("jd_text"),
            "jd_analysis": jd_analysis,
            "analyst_report": analyst_report,
            "candidate_name": data.get("candidate_name") or "Candidate",
            "raw_resume_text": raw_resume_text,
            "parsed_resume": parsed_resume,
            "original_ats": original_ats,
            "original_resume_url": data.get("original_resume_url"),
            "original_resume_filename": data.get("original_resume_filename"),
            "original_resume_file_type": data.get("original_resume_file_type"),
            "want_cover_letter": bool(data.get("want_cover_letter", False)),
            "candidate_email_to_send": data.get("candidate_email_to_send"),
            "template_id": data.get("template_id") or DEFAULT_TEMPLATE,
            # Timing anchors for the total processing-time calculation.
            "started_at": data.get("started_at"),
            "analysis_ended_at": data.get("analysis_ended_at"),
            "generation_started_at": data.get("generation_started_at"),
        }
        accepted_report = _report_with_accepted_changes(
            analyst_report, proposed_changes
        )
        return await _run_generation_phase(
            pipeline_id=pipeline_id,
            analysis=analysis,
            accepted_report=accepted_report,
            progress_callback=progress_callback,
        )

"""Google ADK agent that rewrites a resume tailored to a specific JD."""
from __future__ import annotations

import copy
import json
from typing import Any

from google.adk.agents import Agent

from app.agents._common import AgentRunner, strip_code_fences
from app.core.constants import PRO_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.jd import JDAnalysis
from app.tools.ats_scorer import score_resume

SYSTEM_INSTRUCTION = load_prompt("resume_writer")


resume_writer_agent = Agent(
    name="resume_writer_agent",
    model=chat_model(PRO_MODEL),
    instruction=SYSTEM_INSTRUCTION,
)

_runner = AgentRunner(resume_writer_agent)


async def run_resume_writer(
    original_resume_text: str,
    jd_analysis: JDAnalysis,
    analyst_report: dict[str, Any],
    candidate_name: str,
) -> str:
    jd_json = jd_analysis.model_dump_json(indent=2, exclude_none=True)
    analyst_json = json.dumps(analyst_report, indent=2, ensure_ascii=False)

    prompt = (
        f"candidate_name: {candidate_name}\n\n"
        f"original_resume:\n{original_resume_text}\n\n"
        f"jd_analysis:\n{jd_json}\n\n"
        f"analyst_report:\n{analyst_json}"
    )

    raw = await _runner.run(prompt)
    return strip_code_fences(raw)


def _supportable_keywords(
    jd_analysis: JDAnalysis,
    analyst_report: dict[str, Any],
    original_resume_text: str,
) -> set[str]:
    """JD keywords the candidate's REAL experience can legitimately support.

    A keyword is supportable if it already appears in the original resume, or
    the analyst flagged it as a matching skill / transferable experience. This
    is the anti-stuffing gate: the feedback loop may only nudge the writer
    toward these terms, never toward skills the candidate doesn't have.
    """
    resume_lower = original_resume_text.lower()
    real_signals = " ".join(
        [
            *(analyst_report.get("matching_skills") or []),
            *(analyst_report.get("transferable_experiences") or []),
        ]
    ).lower()
    supportable: set[str] = set()
    for kw in jd_analysis.ats_keywords:
        if not kw:
            continue
        k = kw.lower()
        if k in resume_lower or k in real_signals:
            supportable.add(kw)
    return supportable


async def run_resume_writer_with_feedback(
    original_resume_text: str,
    jd_analysis: JDAnalysis,
    analyst_report: dict[str, Any],
    candidate_name: str,
    min_score: int = 75,
    max_iterations: int = 2,
) -> tuple[str, dict[str, Any]]:
    working_report = copy.deepcopy(analyst_report)
    working_report.setdefault("rewrite_instructions", [])

    supportable = _supportable_keywords(
        jd_analysis, working_report, original_resume_text
    )

    final_text = ""
    score_result: dict[str, Any] = {}

    for _ in range(max(1, max_iterations)):
        final_text = await run_resume_writer(
            original_resume_text,
            jd_analysis,
            working_report,
            candidate_name,
        )
        score_result = score_resume(final_text, jd_analysis.ats_keywords)
        if score_result["final_score"] >= min_score:
            break
        # Only nudge toward keywords the candidate's real experience supports.
        # Stuffing unsupported keywords to hit a score is exactly what we're
        # trying to prevent — so if none are supportable, stop iterating.
        addable = [
            kw for kw in score_result["missing_keywords"] if kw in supportable
        ]
        if not addable:
            break
        working_report["rewrite_instructions"].append(
            f"FEEDBACK: Score was {score_result['final_score']}. Consider naturally "
            f"weaving in these JD terms that your real experience already supports: "
            f"{addable}. Do NOT add skills or experience you don't have."
        )

    return final_text, score_result

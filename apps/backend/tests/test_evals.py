"""End-to-end eval suite for the agents.

These tests hit the real Gemini API and are skipped automatically unless a
key is present in the environment. They are designed to catch *quality*
regressions (not just shape regressions like the contract tests), so the
assertions check semantic properties of the output — keyword overlap, score
floors, presence of candidate names, etc.

Run them deliberately:

    GEMINI_API_KEY=... uv run pytest tests/test_evals.py -v --tb=short

Each case is parametrized so a failure points at *which* (resume, JD) pair
broke. Keep the case list short — every run costs real money.
"""
from __future__ import annotations

import os
import re

import pytest

from tests.eval_fixtures import ALL_CASES, EvalCase

requires_gemini = pytest.mark.skipif(
    not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")),
    reason="GEMINI_API_KEY / GOOGLE_API_KEY not set",
)


@pytest.fixture(params=ALL_CASES, ids=[c.name for c in ALL_CASES])
def case(request) -> EvalCase:
    return request.param


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    lower = text.lower()
    return any(k.lower() in lower for k in keywords)


# --- jd_parser ---------------------------------------------------------------


@requires_gemini
async def test_jd_parser_extracts_core_fields(case: EvalCase):
    from app.agents.jd_parser import run_jd_parser

    result = await run_jd_parser(case.jd)

    assert result.role_title, "role_title is empty"
    assert _contains_any(result.role_title, case.expected_role_keywords), (
        f"role_title {result.role_title!r} missing any of "
        f"{case.expected_role_keywords}"
    )
    assert result.company_name, "company_name is empty"
    assert len(result.required_skills) >= case.min_required_skills, (
        f"required_skills had only {len(result.required_skills)} entries"
    )
    assert len(result.ats_keywords) >= case.min_ats_keywords, (
        f"ats_keywords had only {len(result.ats_keywords)} entries"
    )


# --- resume_parser -----------------------------------------------------------


@requires_gemini
async def test_resume_parser_extracts_candidate(case: EvalCase):
    from app.agents.resume_parser import run_resume_parser

    parsed = await run_resume_parser(case.resume)

    assert parsed.candidate_name, "candidate_name not extracted"
    assert (
        case.expected_candidate_name.lower() in parsed.candidate_name.lower()
    ), f"expected {case.expected_candidate_name}, got {parsed.candidate_name}"
    assert parsed.candidate_email, "candidate_email not extracted"
    assert "@" in parsed.candidate_email
    assert len(parsed.experience) >= 2, "fewer than 2 experience entries parsed"
    assert len(parsed.skills) >= 3, "fewer than 3 skills parsed"


# --- resume_analyst ----------------------------------------------------------


@requires_gemini
async def test_resume_analyst_returns_actionable_report(case: EvalCase):
    from app.agents.jd_parser import run_jd_parser
    from app.agents.resume_analyst import run_resume_analyst
    from app.schemas.resume import ParsedResume

    jd = await run_jd_parser(case.jd)
    parsed = ParsedResume(candidate_name=case.expected_candidate_name, summary=case.resume)

    report = await run_resume_analyst(parsed, jd)

    assert isinstance(report, dict)
    instructions = report.get("rewrite_instructions") or []
    assert isinstance(instructions, list)
    assert len(instructions) >= 1, "no rewrite_instructions returned"
    # matching_skills is conventional; even when empty it should be a list.
    matching = report.get("matching_skills", [])
    assert isinstance(matching, list)


# --- resume_writer (full feedback loop) -------------------------------------


@requires_gemini
async def test_resume_writer_with_feedback_meets_floors(case: EvalCase):
    from app.agents.jd_parser import run_jd_parser
    from app.agents.resume_analyst import run_resume_analyst
    from app.agents.resume_writer import run_resume_writer_with_feedback
    from app.schemas.resume import ParsedResume

    jd = await run_jd_parser(case.jd)
    parsed = ParsedResume(candidate_name=case.expected_candidate_name, summary=case.resume)
    report = await run_resume_analyst(parsed, jd)

    text, score = await run_resume_writer_with_feedback(
        original_resume_text=case.resume,
        jd_analysis=jd,
        analyst_report=report,
        candidate_name=case.expected_candidate_name,
    )

    assert text, "writer returned empty output"
    assert case.expected_candidate_name.lower() in text.lower(), (
        "tailored resume dropped the candidate name"
    )
    assert score["final_score"] >= case.min_final_score, (
        f"final_score={score['final_score']} below floor {case.min_final_score}"
    )

    text_lower = text.lower()
    hit_expected = sum(
        1 for k in case.expected_ats_keywords if k.lower() in text_lower
    )
    coverage = hit_expected / len(case.expected_ats_keywords)
    assert coverage >= case.min_keyword_coverage, (
        f"expected keyword coverage {coverage:.0%} below floor "
        f"{case.min_keyword_coverage:.0%} "
        f"({hit_expected}/{len(case.expected_ats_keywords)})"
    )

    # No placeholders left over from the prompt template.
    assert not re.search(r"\[(insert|your [a-z ]+|tbd)\]", text, re.IGNORECASE), (
        "writer output still contains template placeholders"
    )

    # Anti-fabrication: the writer must not claim skills the candidate's resume
    # never mentioned, even though the JD asks for them.
    fabricated = [
        skill
        for skill in case.forbidden_skills
        if skill.lower() in text_lower and skill.lower() not in case.resume.lower()
    ]
    assert not fabricated, (
        f"tailored resume fabricated unsupported skills: {fabricated}"
    )


# --- cover_letter ------------------------------------------------------------


@requires_gemini
async def test_cover_letter_personalizes(case: EvalCase):
    from app.agents.cover_letter import run_cover_letter_agent
    from app.agents.jd_parser import run_jd_parser

    jd = await run_jd_parser(case.jd)
    text = await run_cover_letter_agent(
        resume_summary=case.resume,
        jd_analysis=jd,
        candidate_name=case.expected_candidate_name,
    )

    assert text, "cover letter is empty"
    assert case.expected_candidate_name.lower() in text.lower()
    assert jd.company_name.lower() in text.lower(), (
        "cover letter never mentions the company"
    )
    assert "```" not in text, "cover letter still has code fences"


# --- email_drafter -----------------------------------------------------------


@requires_gemini
async def test_email_drafter_subject_mentions_role(case: EvalCase):
    from app.agents.email_drafter import run_email_drafter

    role_title = "Senior Engineer"  # synthetic — agent should still respect it
    company_name = "Acme Co"
    out = await run_email_drafter(
        candidate_name=case.expected_candidate_name,
        role_title=role_title,
        company_name=company_name,
        fit_summary="Strong Python + distributed systems background.",
    )

    assert out["subject"], "email subject is empty"
    assert out["body"], "email body is empty"
    # Subject should reference role or company; LLMs sometimes drop one.
    haystack = out["subject"].lower()
    assert "engineer" in haystack or company_name.lower() in haystack, (
        f"subject {out['subject']!r} mentions neither role nor company"
    )


# --- interview_prep ----------------------------------------------------------


@requires_gemini
async def test_interview_prep_has_full_packet(case: EvalCase):
    from app.agents.interview_prep import run_interview_prep
    from app.agents.jd_parser import run_jd_parser
    from app.schemas.resume import ParsedResume

    jd = await run_jd_parser(case.jd)
    parsed = ParsedResume(candidate_name=case.expected_candidate_name, summary=case.resume)

    prep = await run_interview_prep(parsed, jd)

    assert len(prep.behavioral) >= 3, "fewer than 3 behavioral questions"
    assert len(prep.technical) >= 3, "fewer than 3 technical questions"
    assert len(prep.role_specific) >= 3, "fewer than 3 role-specific questions"
    assert len(prep.questions_to_ask) >= 2, "fewer than 2 'questions to ask'"
    # Every question should have both a question and a suggested answer.
    for cat in (prep.behavioral, prep.technical, prep.role_specific):
        for q in cat:
            assert q.question.strip()
            assert q.suggested_answer.strip()

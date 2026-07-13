"""Agent tests.

The LLM-backed tests hit the real Gemini API (which costs money and time),
so they are skipped automatically when no API key is present in the env.
"""
from __future__ import annotations

import os

import pytest

requires_gemini = pytest.mark.skipif(
    not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")),
    reason="GEMINI_API_KEY / GOOGLE_API_KEY not set",
)


@requires_gemini
async def test_jd_parser_returns_valid_schema(sample_jd_text):
    from app.agents.jd_parser import run_jd_parser

    result = await run_jd_parser(sample_jd_text)

    assert result.role_title
    assert result.company_name
    assert len(result.required_skills) > 0
    assert len(result.ats_keywords) >= 5


@requires_gemini
async def test_resume_analyst_returns_rewrite_instructions(
    sample_resume_text, sample_jd_text
):
    from app.agents.jd_parser import run_jd_parser
    from app.agents.resume_analyst import run_resume_analyst
    from app.schemas.resume import ParsedResume

    jd_analysis = await run_jd_parser(sample_jd_text)
    parsed_resume = ParsedResume(
        candidate_name="Jane Doe", summary=sample_resume_text
    )
    report = await run_resume_analyst(parsed_resume, jd_analysis)

    assert "rewrite_instructions" in report
    assert isinstance(report["rewrite_instructions"], list)


@requires_gemini
async def test_resume_writer_contains_ats_keywords(
    sample_resume_text, sample_jd_text
):
    from app.agents.jd_parser import run_jd_parser
    from app.agents.resume_analyst import run_resume_analyst
    from app.agents.resume_writer import run_resume_writer
    from app.schemas.resume import ParsedResume

    jd_analysis = await run_jd_parser(sample_jd_text)
    parsed_resume = ParsedResume(
        candidate_name="Jane Doe", summary=sample_resume_text
    )
    analyst_report = await run_resume_analyst(parsed_resume, jd_analysis)

    output = await run_resume_writer(
        original_resume_text=sample_resume_text,
        jd_analysis=jd_analysis,
        analyst_report=analyst_report,
        candidate_name="Jane Doe",
    )

    output_lower = output.lower()
    matched = sum(
        1 for kw in jd_analysis.ats_keywords if kw.lower() in output_lower
    )
    coverage = matched / max(1, len(jd_analysis.ats_keywords))
    assert coverage >= 0.6, (
        f"Only {coverage:.0%} of ATS keywords found in writer output "
        f"({matched}/{len(jd_analysis.ats_keywords)})"
    )


def test_ats_scorer_perfect_match():
    from app.tools.ats_scorer import score_resume

    keywords = ["Python", "PyTorch", "Kubernetes"]
    resume = """Jane Doe

SUMMARY
Engineer building production ML systems.

EXPERIENCE
Senior Engineer | Acme | 2020 - 2024
- Shipped Python services with PyTorch
- Migrated infra to Kubernetes

SKILLS
Python, PyTorch, Kubernetes

EDUCATION
B.S. Computer Science
"""
    result = score_resume(resume, keywords)

    assert result["score"] == 100
    assert result["final_score"] == 100
    assert result["matched_keywords"] == keywords
    assert result["missing_keywords"] == []


def test_ats_scorer_zero_match():
    from app.tools.ats_scorer import score_resume

    keywords = ["Rust", "WebAssembly", "Solidity"]
    resume = "Just some plain text without any of the listed keywords."
    result = score_resume(resume, keywords)

    assert result["score"] == 0
    assert result["matched_keywords"] == []
    assert set(result["missing_keywords"]) == set(keywords)
    # Final score is clamped to 0 (no sections present, penalties exceed score).
    assert result["final_score"] == 0

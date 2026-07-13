"""Contract tests for agent wrappers.

These tests do NOT hit Gemini. They monkeypatch each agent's `AgentRunner.run`
to return a recorded raw LLM response, then assert that the public `run_*`
function parses it into the right shape. They guard against regressions in
the JSON-extraction / fence-stripping plumbing in `app.agents._common`.
"""
from __future__ import annotations

import json
from typing import Any

import pytest

from app.agents import _common


def _stub_runner(monkeypatch: pytest.MonkeyPatch, module_path: str, raw: str) -> None:
    """Replace the module-level `_runner.run` with an async stub returning `raw`."""
    import importlib

    module = importlib.import_module(module_path)

    async def fake_run(_prompt: str) -> str:
        return raw

    monkeypatch.setattr(module._runner, "run", fake_run)


# --- _common helpers ---------------------------------------------------------


def test_extract_json_strips_fences():
    text = "```json\n{\"a\": 1}\n```"
    assert _common.extract_json(text) == '{"a": 1}'


def test_extract_json_handles_bare_object():
    text = "noise before {\"a\": 1, \"b\": 2} noise after"
    assert _common.extract_json(text) == '{"a": 1, "b": 2}'


def test_extract_json_removes_trailing_commas():
    text = '{"a": 1, "b": [1, 2,],}'
    assert _common.extract_json(text) == '{"a": 1, "b": [1, 2]}'


def test_strip_code_fences_removes_surrounding_fences():
    text = "```markdown\nhello world\n```"
    assert _common.strip_code_fences(text) == "hello world"


def test_strip_code_fences_no_fences_is_noop():
    assert _common.strip_code_fences("plain text\n") == "plain text"


# --- jd_parser ---------------------------------------------------------------


async def test_jd_parser_parses_recorded_json(monkeypatch):
    from app.agents.jd_parser import run_jd_parser

    recorded = json.dumps(
        {
            "role_title": "Senior ML Engineer",
            "company_name": "Acme AI",
            "location": "SF",
            "remote_ok": True,
            "required_skills": ["Python", "PyTorch"],
            "ats_keywords": ["Python", "PyTorch", "Kubernetes"],
        }
    )
    _stub_runner(monkeypatch, "app.agents.jd_parser", recorded)

    result = await run_jd_parser("any jd text")
    assert result.role_title == "Senior ML Engineer"
    assert result.company_name == "Acme AI"
    assert result.remote_ok is True
    assert "Kubernetes" in result.ats_keywords


async def test_jd_parser_raises_on_invalid_json(monkeypatch):
    from app.agents.jd_parser import run_jd_parser

    _stub_runner(monkeypatch, "app.agents.jd_parser", "not json at all")
    with pytest.raises(ValueError, match="invalid JSON"):
        await run_jd_parser("any jd text")


# --- resume_parser -----------------------------------------------------------


async def test_resume_parser_parses_recorded_json(monkeypatch):
    from app.agents.resume_parser import run_resume_parser

    recorded = "```json\n" + json.dumps(
        {
            "candidate_name": "Jane Doe",
            "candidate_email": "jane@example.com",
            "skills": ["Python", "SQL"],
            "experience": [
                {
                    "company": "Acme",
                    "title": "Engineer",
                    "bullets": ["shipped things"],
                }
            ],
        }
    ) + "\n```"
    _stub_runner(monkeypatch, "app.agents.resume_parser", recorded)

    result = await run_resume_parser("raw resume text")
    assert result.candidate_name == "Jane Doe"
    assert result.candidate_email == "jane@example.com"
    assert result.experience[0].company == "Acme"


# --- resume_analyst ----------------------------------------------------------


async def test_resume_analyst_returns_dict(monkeypatch):
    from app.agents.jd_parser import run_jd_parser  # noqa: F401  (just to import)
    from app.agents.resume_analyst import run_resume_analyst
    from app.schemas.jd import JDAnalysis
    from app.schemas.resume import ParsedResume

    recorded = json.dumps(
        {
            "matching_skills": ["Python"],
            "transferable_experiences": ["Led ML team"],
            "rewrite_instructions": ["Lead with Python impact"],
            "candidate_name": "Jane Doe",
        }
    )
    _stub_runner(monkeypatch, "app.agents.resume_analyst", recorded)

    jd = JDAnalysis(
        role_title="ML Eng",
        company_name="Acme",
        ats_keywords=["Python"],
    )
    parsed = ParsedResume(candidate_name="Jane Doe", summary="...")

    report: dict[str, Any] = await run_resume_analyst(parsed, jd)
    assert report["matching_skills"] == ["Python"]
    assert report["rewrite_instructions"] == ["Lead with Python impact"]


async def test_resume_analyst_parses_proposed_changes(monkeypatch):
    from app.agents.resume_analyst import run_resume_analyst
    from app.schemas.jd import JDAnalysis
    from app.schemas.resume import ParsedResume

    recorded = json.dumps(
        {
            "candidate_name": "Jane Doe",
            "matching_skills": ["Python"],
            "missing_skills": ["AWS"],
            "transferable_experiences": [],
            "weak_sections": ["summary"],
            "rewrite_instructions": ["Tailor the summary"],
            "proposed_changes": [
                {
                    "id": "chg_1",
                    "category": "summary",
                    "title": "Tailor the professional summary",
                    "detail": "Emphasize real Python/ML strengths for this role.",
                    "before": "AI Engineer passionate about ML.",
                    "after": "AI Engineer with Python and ML model experience.",
                }
            ],
        }
    )
    _stub_runner(monkeypatch, "app.agents.resume_analyst", recorded)

    jd = JDAnalysis(role_title="ML Eng", company_name="Acme", ats_keywords=["Python"])
    parsed = ParsedResume(candidate_name="Jane Doe", summary="...")

    report: dict[str, Any] = await run_resume_analyst(parsed, jd)
    changes = report["proposed_changes"]
    assert len(changes) == 1
    assert changes[0]["id"] == "chg_1"
    assert changes[0]["category"] == "summary"


# --- resume_writer -----------------------------------------------------------


async def test_resume_writer_strips_code_fences(monkeypatch):
    from app.agents.resume_writer import run_resume_writer
    from app.schemas.jd import JDAnalysis

    recorded = "```markdown\nJane Doe\n\nSUMMARY\nGreat engineer.\n```"
    _stub_runner(monkeypatch, "app.agents.resume_writer", recorded)

    jd = JDAnalysis(role_title="ML Eng", company_name="Acme", ats_keywords=["Python"])
    out = await run_resume_writer(
        original_resume_text="...",
        jd_analysis=jd,
        analyst_report={"rewrite_instructions": []},
        candidate_name="Jane Doe",
    )
    assert out.startswith("Jane Doe")
    assert "```" not in out


async def test_resume_writer_with_feedback_stops_on_high_score(monkeypatch):
    from app.agents import resume_writer
    from app.schemas.jd import JDAnalysis

    call_count = {"n": 0}

    async def fake_run(_prompt: str) -> str:
        call_count["n"] += 1
        return "Jane Doe\n\nSKILLS: Python, PyTorch, Kubernetes"

    monkeypatch.setattr(resume_writer._runner, "run", fake_run)
    monkeypatch.setattr(
        resume_writer,
        "score_resume",
        lambda _text, _kw: {
            "score": 100,
            "final_score": 100,
            "matched_keywords": ["Python"],
            "missing_keywords": [],
        },
    )

    jd = JDAnalysis(role_title="ML Eng", company_name="Acme", ats_keywords=["Python"])
    text, score = await resume_writer.run_resume_writer_with_feedback(
        original_resume_text="...",
        jd_analysis=jd,
        analyst_report={},
        candidate_name="Jane Doe",
        min_score=75,
        max_iterations=3,
    )
    assert score["final_score"] == 100
    # Should have stopped after the first iteration since score >= min_score.
    assert call_count["n"] == 1
    assert "Python" in text


async def test_resume_writer_feedback_does_not_stuff_unsupported_keywords(monkeypatch):
    """A low score with only UNSUPPORTED missing keywords must not trigger a
    re-run that stuffs them in — the loop should stop after one iteration."""
    from app.agents import resume_writer
    from app.schemas.jd import JDAnalysis

    call_count = {"n": 0}

    async def fake_run(_prompt: str) -> str:
        call_count["n"] += 1
        return "Jane Doe\n\nSKILLS: Python"

    monkeypatch.setattr(resume_writer._runner, "run", fake_run)
    # Score stays below min_score; the only missing keyword is AWS, which the
    # candidate does NOT have (not in resume text, not in analyst signals).
    monkeypatch.setattr(
        resume_writer,
        "score_resume",
        lambda _text, _kw: {
            "score": 50,
            "final_score": 50,
            "matched_keywords": ["Python"],
            "missing_keywords": ["AWS"],
        },
    )

    jd = JDAnalysis(
        role_title="ML Eng", company_name="Acme", ats_keywords=["Python", "AWS"]
    )
    _text, score = await resume_writer.run_resume_writer_with_feedback(
        original_resume_text="Jane Doe, Python developer",
        jd_analysis=jd,
        analyst_report={"matching_skills": ["Python"]},
        candidate_name="Jane Doe",
        min_score=75,
        max_iterations=3,
    )
    assert score["final_score"] == 50
    # AWS is unsupported, so no extra iterations to stuff it in.
    assert call_count["n"] == 1


async def test_resume_writer_feedback_retries_for_supportable_keyword(monkeypatch):
    """A supportable missing keyword (present in the original resume) should
    trigger a feedback re-run."""
    from app.agents import resume_writer
    from app.schemas.jd import JDAnalysis

    call_count = {"n": 0}

    async def fake_run(_prompt: str) -> str:
        call_count["n"] += 1
        return "Jane Doe\n\nSKILLS: Python"

    monkeypatch.setattr(resume_writer._runner, "run", fake_run)
    monkeypatch.setattr(
        resume_writer,
        "score_resume",
        lambda _text, _kw: {
            "score": 50,
            "final_score": 50,
            "matched_keywords": [],
            "missing_keywords": ["PyTorch"],
        },
    )

    jd = JDAnalysis(
        role_title="ML Eng", company_name="Acme", ats_keywords=["PyTorch"]
    )
    # PyTorch is in the original resume → supportable → loop should iterate.
    await resume_writer.run_resume_writer_with_feedback(
        original_resume_text="Jane Doe. Built models with PyTorch.",
        jd_analysis=jd,
        analyst_report={},
        candidate_name="Jane Doe",
        min_score=75,
        max_iterations=2,
    )
    assert call_count["n"] == 2


# --- cover_letter ------------------------------------------------------------


async def test_cover_letter_strips_fences(monkeypatch):
    from app.agents.cover_letter import run_cover_letter_agent
    from app.schemas.jd import JDAnalysis

    recorded = "```\nDear hiring manager,\n\nI'd love to join Acme.\n```"
    _stub_runner(monkeypatch, "app.agents.cover_letter", recorded)

    jd = JDAnalysis(role_title="ML Eng", company_name="Acme")
    out = await run_cover_letter_agent(
        resume_summary="seven years of python",
        jd_analysis=jd,
        candidate_name="Jane Doe",
    )
    assert out.startswith("Dear")
    assert "```" not in out


# --- email_drafter -----------------------------------------------------------


async def test_email_drafter_returns_subject_and_body(monkeypatch):
    from app.agents.email_drafter import run_email_drafter

    recorded = json.dumps(
        {
            "subject": "Application: Senior ML Engineer at Acme AI",
            "body": "Hi team, ...",
        }
    )
    _stub_runner(monkeypatch, "app.agents.email_drafter", recorded)

    out = await run_email_drafter(
        candidate_name="Jane Doe",
        role_title="Senior ML Engineer",
        company_name="Acme AI",
        fit_summary="strong fit",
    )
    assert out["subject"].startswith("Application:")
    assert out["body"] == "Hi team, ..."


# --- skill_roadmap / recruiter_review / resume_risks -------------------------


async def test_skill_roadmap_parses_recorded_json(monkeypatch):
    from app.agents.skill_roadmap import run_skill_roadmap
    from app.schemas.jd import JDAnalysis

    recorded = json.dumps(
        {
            "gaps": [
                {"skill": "Docker", "importance": "critical", "status": "missing", "why": "core req"}
            ],
            "roadmap": [
                {"week": 1, "focus": "Docker basics", "resources": ["Docker docs"], "project": "Containerize an app"}
            ],
            "summary": "One key gap to close.",
        }
    )
    _stub_runner(monkeypatch, "app.agents.skill_roadmap", recorded)

    jd = JDAnalysis(role_title="ML Eng", company_name="Acme", ats_keywords=["Docker"])
    out = await run_skill_roadmap(jd, {"missing_skills": ["Docker"]}, ["Python"])
    assert out.gaps[0].skill == "Docker"
    assert out.roadmap[0].week == 1


async def test_recruiter_review_parses_recorded_json(monkeypatch):
    from app.agents.recruiter_review import run_recruiter_review
    from app.schemas.jd import JDAnalysis

    recorded = json.dumps(
        {
            "strengths": ["Strong Python"],
            "concerns": ["No cloud experience"],
            "hiring_recommendation": "maybe",
            "verdict": "Borderline — phone screen.",
        }
    )
    _stub_runner(monkeypatch, "app.agents.recruiter_review", recorded)

    jd = JDAnalysis(role_title="ML Eng", company_name="Acme")
    out = await run_recruiter_review("resume text", jd)
    assert out.hiring_recommendation == "maybe"
    assert out.strengths == ["Strong Python"]


async def test_resume_risks_parses_recorded_json(monkeypatch):
    from app.agents.resume_risks import run_resume_risks
    from app.schemas.jd import JDAnalysis

    recorded = json.dumps(
        {
            "risks": [
                {
                    "type": "no_measurable_achievements",
                    "severity": "high",
                    "detail": "Bullets describe duties only.",
                    "fix": "Add real outcomes where you have them.",
                }
            ],
            "summary": "One high-severity issue.",
        }
    )
    _stub_runner(monkeypatch, "app.agents.resume_risks", recorded)

    jd = JDAnalysis(role_title="ML Eng", company_name="Acme")
    out = await run_resume_risks("resume text", jd)
    assert out.risks[0].severity == "high"
    assert out.risks[0].type == "no_measurable_achievements"


async def test_resume_structurer_parses_recorded_json(monkeypatch):
    from app.agents.resume_structurer import run_resume_structurer

    recorded = json.dumps(
        {
            "name": "Jane Doe",
            "headline": "ML Engineer",
            "links": [
                {"label": "jane@x.com", "url": "mailto:jane@x.com", "kind": "email"}
            ],
            "summary": "Builds ML systems.",
            "skills": [{"label": "Languages", "items": ["Python", "Go"]}],
            "experience": [
                {
                    "company": "Acme",
                    "role": "Engineer",
                    "end_date": "Present",
                    "bullets": ["Shipped a model"],
                }
            ],
        }
    )
    _stub_runner(monkeypatch, "app.agents.resume_structurer", recorded)

    out = await run_resume_structurer("resume text", "Jane Doe")
    assert out.name == "Jane Doe"
    assert out.experience[0].company == "Acme"
    assert out.skills[0].items == ["Python", "Go"]


async def test_resume_structurer_keeps_candidate_name_when_blank(monkeypatch):
    from app.agents.resume_structurer import run_resume_structurer

    _stub_runner(
        monkeypatch, "app.agents.resume_structurer", json.dumps({"name": ""})
    )
    out = await run_resume_structurer("resume text", "Jane Doe")
    assert out.name == "Jane Doe"


async def test_email_drafter_raises_when_keys_missing(monkeypatch):
    from app.agents.email_drafter import run_email_drafter

    _stub_runner(
        monkeypatch, "app.agents.email_drafter", json.dumps({"subject": "x"})
    )
    with pytest.raises(ValueError, match="subject"):
        await run_email_drafter(
            candidate_name="Jane",
            role_title="r",
            company_name="c",
            fit_summary="f",
        )

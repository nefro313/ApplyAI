from pydantic import BaseModel, Field


class AtsBreakdown(BaseModel):
    keyword_match: int = 0
    skills_match: int = 0
    experience_match: int = 0
    education_match: int = 0
    formatting: int = 0


class AtsAnalysis(BaseModel):
    """LLM-produced ATS evaluation of a resume against a JD.

    Distinct from the deterministic `score_resume` in `app/tools/ats_scorer.py`,
    which the resume_writer feedback loop uses to gate its iterations. This one
    is the richer, human-facing scorecard shown in the UI.
    """

    score: int = 0
    matched_keywords: list[str] = Field(default_factory=list)
    missing_keywords: list[str] = Field(default_factory=list)
    breakdown: AtsBreakdown = Field(default_factory=AtsBreakdown)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    summary: str | None = None

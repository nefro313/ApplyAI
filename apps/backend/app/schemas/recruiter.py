"""Schema for the recruiter-perspective review agent output."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

HiringRecommendation = Literal["strong_yes", "yes", "maybe", "no"]


class RecruiterReview(BaseModel):
    strengths: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    hiring_recommendation: HiringRecommendation = "maybe"
    verdict: str | None = None

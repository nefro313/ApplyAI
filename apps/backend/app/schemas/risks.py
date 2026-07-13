"""Schema for the resume-risk-detector agent output."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RiskSeverity = Literal["high", "medium", "low"]


class ResumeRisk(BaseModel):
    type: str
    severity: RiskSeverity = "medium"
    detail: str
    fix: str | None = None


class ResumeRisks(BaseModel):
    risks: list[ResumeRisk] = Field(default_factory=list)
    summary: str | None = None

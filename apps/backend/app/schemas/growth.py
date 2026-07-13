"""Schemas for the skill-gap + learning-roadmap agent output."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SkillImportance = Literal["critical", "important", "nice_to_have"]
SkillStatus = Literal["missing", "partial"]


class SkillGap(BaseModel):
    skill: str
    importance: SkillImportance = "important"
    status: SkillStatus = "missing"
    why: str | None = None


class RoadmapWeek(BaseModel):
    week: int
    focus: str
    resources: list[str] = Field(default_factory=list)
    project: str | None = None


class SkillRoadmap(BaseModel):
    gaps: list[SkillGap] = Field(default_factory=list)
    roadmap: list[RoadmapWeek] = Field(default_factory=list)
    summary: str | None = None

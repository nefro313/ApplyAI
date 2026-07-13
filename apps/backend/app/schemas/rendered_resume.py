"""The structured rendering contract for resume templates.

`resume_writer` emits the tailored resume as plain text (the source of truth
for the diff view and the deterministic ATS score). To render it into a rich,
multi-template PDF we need typed fields the HTML templates can bind to — a name,
contact links, summary, skill groups, and typed experience/education/project
entries. The `resume_structurer` agent produces this from the tailored text;
`document_builder` feeds it into one of the HTML/CSS templates.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# Used to pick an icon + brand color in the templates. "web" is the catch-all.
LinkKind = Literal["email", "phone", "website", "github", "linkedin", "other"]


class ContactLink(BaseModel):
    label: str  # display text, e.g. "github.com/jane" or "jane@example.com"
    url: str  # href — may be mailto:/tel: for email/phone
    kind: LinkKind = "other"


class RenderExperience(BaseModel):
    company: str
    role: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None  # e.g. "Present"
    bullets: list[str] = Field(default_factory=list)


class RenderEducation(BaseModel):
    institution: str
    degree: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    details: list[str] = Field(default_factory=list)


class RenderProject(BaseModel):
    name: str
    link: ContactLink | None = None
    bullets: list[str] = Field(default_factory=list)


class SkillGroup(BaseModel):
    """A labelled skill row, e.g. label="Languages", items=["Python", "Go"].

    When the source resume lists skills flat (no categories), the structurer
    emits a single group with an empty label.
    """

    label: str = ""
    items: list[str] = Field(default_factory=list)


class ExtraSection(BaseModel):
    """Anything that isn't experience/education/projects/skills — e.g.
    Activities, Publications, Certifications, Awards. Kept generic so templates
    render them uniformly after the core sections."""

    heading: str
    bullets: list[str] = Field(default_factory=list)


class StructuredResume(BaseModel):
    name: str
    headline: str | None = None  # e.g. "Data Scientist / Junior Developer"
    location: str | None = None
    links: list[ContactLink] = Field(default_factory=list)
    summary: str | None = None
    skills: list[SkillGroup] = Field(default_factory=list)
    experience: list[RenderExperience] = Field(default_factory=list)
    projects: list[RenderProject] = Field(default_factory=list)
    education: list[RenderEducation] = Field(default_factory=list)
    extras: list[ExtraSection] = Field(default_factory=list)

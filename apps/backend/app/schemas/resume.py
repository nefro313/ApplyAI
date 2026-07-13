from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

FileType = Literal["pdf", "docx", "txt"]


class ResumeUploadResponse(BaseModel):
    file_id: str
    gcs_url: str
    file_type: FileType
    uploaded_at: datetime
    text_length: int


class ExperienceEntry(BaseModel):
    company: str
    title: str
    start_date: str | None = None
    end_date: str | None = None
    location: str | None = None
    bullets: list[str] = Field(default_factory=list)


class EducationEntry(BaseModel):
    institution: str
    degree: str | None = None
    field: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class ProjectEntry(BaseModel):
    name: str
    description: str | None = None
    bullets: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)


class ResumeSection(BaseModel):
    section_name: str
    content: str
    order: int = 0


class ParsedResume(BaseModel):
    candidate_name: str | None = None
    candidate_email: str | None = None
    candidate_phone: str | None = None
    location: str | None = None
    links: list[str] = Field(default_factory=list)
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    years_experience: int | None = None
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    sections: list[ResumeSection] = Field(default_factory=list)

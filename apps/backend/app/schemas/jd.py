from pydantic import BaseModel, Field


class JDAnalysis(BaseModel):
    role_title: str
    company_name: str
    location: str | None = None
    remote_ok: bool = False
    required_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    years_experience_required: int | None = None
    key_responsibilities: list[str] = Field(default_factory=list)
    ats_keywords: list[str] = Field(default_factory=list)

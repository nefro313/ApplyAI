"""Schemas for /api/v1/me/* history endpoints."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ResumeSummary(BaseModel):
    file_id: str
    file_type: str
    uploaded_at: datetime | None = None
    text_length: int = 0
    candidate_name: str | None = None


class PipelineSummary(BaseModel):
    pipeline_id: str
    overall_status: str
    role_title: str | None = None
    company_name: str | None = None
    candidate_name: str | None = None
    final_score: int | None = None
    started_at: datetime | None = None
    updated_at: datetime | None = None
    # Total active processing time in seconds (excludes the review pause).
    duration_seconds: int | None = None

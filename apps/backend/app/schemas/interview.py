"""Schemas for the interview-prep agent output."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


def _coerce_str_list(value: Any) -> Any:
    """Flatten stray dict items into strings.

    The LLM occasionally returns rich `{question, suggested_answer, ...}`
    objects where a plain string is expected (e.g. in `watch_outs`). Rather
    than fail the whole packet, pull a sensible text field out of each dict so
    the item survives as a string. Non-list inputs pass through untouched for
    Pydantic to report normally.
    """
    if not isinstance(value, list):
        return value
    out: list[Any] = []
    for item in value:
        if isinstance(item, dict):
            text = (
                item.get("question")
                or item.get("text")
                or item.get("note")
                or " ".join(str(v) for v in item.values() if isinstance(v, str))
            )
            out.append(text or str(item))
        else:
            out.append(item)
    return out


class InterviewQuestion(BaseModel):
    question: str
    suggested_answer: str
    anchor: str | None = None


class InterviewPrep(BaseModel):
    behavioral: list[InterviewQuestion] = Field(default_factory=list)
    technical: list[InterviewQuestion] = Field(default_factory=list)
    role_specific: list[InterviewQuestion] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    watch_outs: list[str] = Field(default_factory=list)

    @field_validator("questions_to_ask", "watch_outs", mode="before")
    @classmethod
    def _flatten_str_lists(cls, value: Any) -> Any:
        return _coerce_str_list(value)

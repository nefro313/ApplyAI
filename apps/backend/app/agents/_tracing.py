"""Per-pipeline LangSmith trace grouping.

Carries the active pipeline id through the async agent chain via a ContextVar
so every agent run for one pipeline groups under the same LangSmith thread
(`session_id`). The orchestrator (and the on-demand endpoints) open a
`pipeline_trace_context()` for the duration of one run; `AgentRunner` reads
`current_pipeline_id()` when building the trace metadata. A no-op when
LangSmith tracing is disabled.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

_pipeline_id_var: ContextVar[str | None] = ContextVar(
    "pipeline_trace_id", default=None
)


@contextmanager
def pipeline_trace_context(pipeline_id: str | None = None) -> Iterator[None]:
    token = _pipeline_id_var.set(pipeline_id)
    try:
        yield
    finally:
        _pipeline_id_var.reset(token)


def current_pipeline_id() -> str | None:
    return _pipeline_id_var.get()

"""Shared plumbing for ADK agent wrappers.

Every agent in this package follows the same recipe: a module-level `Agent`,
an `InMemorySessionService`, a `Runner`, and a `run_<thing>(...)` coroutine
that creates a session, sends one prompt, drains events, and returns the
final response text. This module centralises that boilerplate so each agent
file only declares its agent and the prompt-shaping logic specific to it.

It also adds the plumbing every agent shares:
- exponential-backoff retries on transient Gemini errors
- a LangSmith trace context so each run is named after the agent and grouped
  under its pipeline's thread
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from typing import Any

import httpx
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from langsmith.integrations.google_adk import create_traced_session_context

from app.agents._tracing import current_pipeline_id

logger = logging.getLogger(__name__)

APP_NAME = "applyai"
USER_ID = "system"

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)
_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")
_CODE_FENCE_RE = re.compile(r"^```[a-zA-Z]*\s*|\s*```$", re.MULTILINE)

# Retry policy. Three attempts (1s, 2s, 4s) is enough to ride out routine
# 503 / 429 blips without making the user wait noticeably longer when the
# upstream is truly down.
_RETRY_ATTEMPTS = 3
_RETRY_BASE_DELAY = 1.0


class EmptyResponseError(RuntimeError):
    """Raised when ADK drains its event stream without a final response.

    Distinct from ValueError so agent wrappers (which catch ValueError to
    surface JSON-parse failures) don't accidentally swallow it.
    """


def _is_transient(exc: BaseException) -> bool:
    """Whether the exception is worth retrying.

    We deliberately enumerate the upstream error classes rather than catching
    `Exception` so a genuine bug (e.g. malformed prompt) fails fast.
    """
    if isinstance(exc, EmptyResponseError):
        return True
    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError)):
        return True
    # google.api_core.exceptions are not always importable depending on the
    # ADK version, so match by class name as a fallback.
    cls_name = type(exc).__name__
    if cls_name in {
        "ResourceExhausted",
        "ServiceUnavailable",
        "DeadlineExceeded",
        "InternalServerError",
        "Aborted",
    }:
        return True
    return False


def extract_json(text: str) -> str:
    """Pull a JSON object out of LLM output. Handles ```json fences, trailing commas."""
    match = _JSON_FENCE_RE.search(text)
    if match:
        candidate = match.group(1).strip()
    else:
        start = text.find("{")
        end = text.rfind("}")
        candidate = (
            text[start : end + 1]
            if start != -1 and end != -1 and end > start
            else text.strip()
        )
    return _TRAILING_COMMA_RE.sub(r"\1", candidate)


def _answer_text(parts: list) -> str:
    """Join the assistant's *answer* text, skipping reasoning ("thought") parts.

    Reasoning models (Groq's ``gpt-oss-*``, OpenAI o-series) return their chain
    of thought as a separate `Part` flagged `thought=True`, followed by the real
    answer in a `thought=False` part. The old code grabbed `parts[0]`, which on
    these models is the *reasoning* — so a JSON agent got prose ("We need to
    produce JSON…") instead of the JSON object and failed to parse. We keep only
    the non-thought parts (the final-channel answer). Models without a thinking
    channel return a single non-thought part, so behaviour there is unchanged.
    """
    answer = [
        part.text
        for part in parts
        if getattr(part, "text", None) and not getattr(part, "thought", False)
    ]
    # Fall back to whatever text exists if the model emitted *only* thought parts
    # (truncated mid-thought) — the caller's empty-check then triggers a retry.
    if not answer:
        answer = [part.text for part in parts if getattr(part, "text", None)]
    return "".join(answer)


def strip_code_fences(text: str) -> str:
    """Strip surrounding ``` fences from free-form text output."""
    return _CODE_FENCE_RE.sub("", text).strip()


class AgentRunner:
    """Wraps one ADK Agent with its own session service + Runner.

    Instantiated once per agent at module load. `run(prompt)` sends a single
    user message with exponential-backoff retries on transient errors, drains
    the event stream inside a LangSmith trace context, and returns the final
    response text. Raises `EmptyResponseError` after exhausting retries on
    persistent empty responses.
    """

    def __init__(self, agent: Agent) -> None:
        self.agent = agent
        self._session_service = InMemorySessionService()
        self._runner = Runner(
            agent=agent,
            app_name=APP_NAME,
            session_service=self._session_service,
        )

    async def _ensure_session(self, session_id: str) -> None:
        create = self._session_service.create_session(
            app_name=APP_NAME,
            user_id=USER_ID,
            session_id=session_id,
        )
        if hasattr(create, "__await__"):
            await create

    async def run(self, prompt: str) -> str:
        last_exc: BaseException | None = None
        for attempt in range(_RETRY_ATTEMPTS):
            try:
                return await self._run_once(prompt)
            except BaseException as exc:
                if not _is_transient(exc):
                    raise
                last_exc = exc
                if attempt == _RETRY_ATTEMPTS - 1:
                    break
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "agent %s attempt %d/%d failed (%s: %s); retrying in %.1fs",
                    self.agent.name,
                    attempt + 1,
                    _RETRY_ATTEMPTS,
                    type(exc).__name__,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
        assert last_exc is not None  # for type-checker; the loop guarantees it
        raise last_exc

    async def _run_once(self, prompt: str) -> str:
        session_id = str(uuid.uuid4())
        await self._ensure_session(session_id)

        content = types.Content(role="user", parts=[types.Part(text=prompt)])
        raw = ""
        # `session_id` is the LangSmith convention for grouping runs into a
        # thread; pipe the caller-supplied pipeline id through so every agent
        # in one pipeline run shows up under the same thread in the UI.
        pipeline_id = current_pipeline_id()
        trace_metadata = {"session_id": pipeline_id} if pipeline_id else None
        with create_traced_session_context(
            name=self.agent.name,
            metadata=trace_metadata,
        ):
            async for event in self._runner.run_async(
                user_id=USER_ID,
                session_id=session_id,
                new_message=content,
            ):
                if event.is_final_response() and event.content and event.content.parts:
                    raw = _answer_text(event.content.parts)

        # Treat whitespace-only output the same as empty: a blank body is a
        # transient model hiccup (more common with chat models over LiteLLM,
        # which don't hard-enforce response_format), so let the retry loop ride
        # it out instead of handing "" downstream to a JSON parser.
        if not raw.strip():
            raise EmptyResponseError(f"{self.agent.name} returned an empty response")

        return raw


async def run_json(runner: AgentRunner, prompt: str) -> Any:
    """Run an agent and parse its output as JSON, re-running on a bad body.

    JSON-returning agents go through `response_format={"type":"json_object"}`,
    but over LiteLLM that's a hint, not a guarantee — a model occasionally
    emits prose, a truncated object, or nothing. A single unparseable response
    used to kill the whole pipeline; here we re-run the agent a few times
    (the per-call transient retries in `AgentRunner.run` still apply on top)
    before giving up with a ValueError, matching the old failure contract.
    """
    last_exc: json.JSONDecodeError | None = None
    for attempt in range(_RETRY_ATTEMPTS):
        raw = await runner.run(prompt)
        try:
            return json.loads(extract_json(raw))
        except json.JSONDecodeError as exc:
            last_exc = exc
            if attempt == _RETRY_ATTEMPTS - 1:
                break
            delay = _RETRY_BASE_DELAY * (2 ** attempt)
            logger.warning(
                "agent %s returned non-JSON (attempt %d/%d: %s); retrying in %.1fs",
                runner.agent.name,
                attempt + 1,
                _RETRY_ATTEMPTS,
                exc,
                delay,
            )
            await asyncio.sleep(delay)
    raise ValueError(
        f"{runner.agent.name} returned invalid JSON: {last_exc}"
    ) from last_exc

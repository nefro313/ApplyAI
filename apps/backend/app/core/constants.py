"""Model selection for the ADK agents.

Agents run on chat models through LiteLLM (`google.adk.models.lite_llm`).
**Groq is the primary provider; OpenAI is the fallback** used only when no
``GROQ_API_KEY`` is set in the environment (``apps/backend/.env``).

Models are tiered so the bigger model is only spent where output quality
matters:

  - PRO  → resume_writer (the tailored-resume generator)
  - MID  → analysis / content-generation agents
  - NANO → deterministic extraction / formatting agents

Groq tiers (primary):
  - PRO / MID → openai/gpt-oss-120b  (120B, strongest)
  - NANO      → llama-3.3-70b-versatile (fast extraction/formatting)

OpenAI tiers (fallback):
  - PRO  → gpt-5
  - MID  → gpt-5-mini
  - NANO → gpt-5-nano

Requires ``GROQ_API_KEY`` (or, as fallback, ``OPENAI_API_KEY``) in the
environment.

Note on structured output: ADK's ``output_schema`` and
``response_mime_type="application/json"`` only constrain Gemini — the LiteLLM
path ignores them. For JSON agents we instead pass ``json_output=True`` so
LiteLLM forwards ``response_format={"type": "json_object"}`` to the provider's
Chat Completions API; the agents' own ``extract_json`` + Pydantic validation
then turn that into typed objects.
"""
from __future__ import annotations

import litellm
from google.adk.models.lite_llm import LiteLlm

from app.core.config import get_settings

# Silently drop request params a given model/provider doesn't accept instead of
# raising `UnsupportedParamsError`. Our agents set per-call temperatures (e.g.
# 0.2/0.3) that Groq's gpt-oss honours, but OpenAI's gpt-5 family only allows
# temperature=1 and LiteLLM otherwise hard-fails the whole call. With this flag
# LiteLLM forwards what each provider supports and drops the rest — so the same
# agent definitions work across providers. Process-wide; set once at import.
litellm.drop_params = True

# Provider selection: Groq when its key is present, else fall back to OpenAI.
# Decided once at import time off the same settings the rest of the app reads.
_USE_GROQ = bool(get_settings().groq_api_key)

# Bump model ids in one place.
if _USE_GROQ:
    PRO_MODEL = "groq/openai/gpt-oss-120b"
    MID_MODEL = "groq/openai/gpt-oss-120b"
    NANO_MODEL = "groq/llama-3.3-70b-versatile"
else:
    PRO_MODEL = "openai/gpt-5"
    MID_MODEL = "openai/gpt-5-mini"
    NANO_MODEL = "openai/gpt-5-nano"


def chat_model(
    model_id: str,
    *,
    json_output: bool = False,
    max_tokens: int | None = None,
) -> LiteLlm:
    """Build a LiteLlm model instance for an ADK agent.

    Pass ``json_output=True`` for agents that must return JSON so the provider
    is asked for a JSON-object response (the Gemini-only ``output_schema`` /
    ``response_mime_type`` settings are ignored over LiteLLM).

    Token budget: Groq's ``gpt-oss-*`` are **reasoning** models whose reasoning
    tokens count toward the completion budget. With ``response_format`` JSON
    mode, a too-small budget truncates the document mid-stream and Groq rejects
    the whole request ("max completion tokens reached before generating a valid
    document", ``json_validate_failed``). So we (a) give every call an ample
    ``max_tokens`` ceiling — larger for JSON, whose schemas are the biggest
    outputs — and (b) dial reasoning down to ``low`` on gpt-oss JSON calls so
    the budget is spent emitting the document rather than thinking about it.
    """
    kwargs: dict = {}
    if json_output:
        kwargs["response_format"] = {"type": "json_object"}
    kwargs["max_tokens"] = max_tokens or (32000 if json_output else 16000)
    # Reasoning-model knob (Groq gpt-oss / OpenAI o-series style). Forwarded as
    # an extra param; ignored by providers/models that don't support it.
    if json_output and "gpt-oss" in model_id:
        kwargs["reasoning_effort"] = "low"
    return LiteLlm(model=model_id, **kwargs)

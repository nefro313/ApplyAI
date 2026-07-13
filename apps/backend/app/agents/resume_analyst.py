"""Google ADK agent that compares a parsed resume against a JD analysis."""
from __future__ import annotations

from typing import Any

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import MID_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.jd import JDAnalysis
from app.schemas.resume import ParsedResume

SYSTEM_INSTRUCTION = load_prompt("resume_analyst")


resume_analyst_agent = Agent(
    name="resume_analyst_agent",
    model=chat_model(MID_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    generate_content_config=types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.3,
    ),
)

_runner = AgentRunner(resume_analyst_agent)


async def run_resume_analyst(
    parsed_resume: ParsedResume,
    jd_analysis: JDAnalysis,
) -> dict[str, Any]:
    resume_json = parsed_resume.model_dump_json(indent=2, exclude_none=True)
    jd_json = jd_analysis.model_dump_json(indent=2, exclude_none=True)
    prompt = f"RESUME:\n{resume_json}\n\nJD ANALYSIS:\n{jd_json}"

    return await run_json(_runner, prompt)

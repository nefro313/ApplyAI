"""Google ADK agent that drafts a personalized cover letter."""
from __future__ import annotations

from google.adk.agents import Agent

from app.agents._common import AgentRunner, strip_code_fences
from app.core.constants import MID_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.jd import JDAnalysis

SYSTEM_INSTRUCTION = load_prompt("cover_letter")


cover_letter_agent = Agent(
    name="cover_letter_agent",
    model=chat_model(MID_MODEL),
    instruction=SYSTEM_INSTRUCTION,
)

_runner = AgentRunner(cover_letter_agent)


async def run_cover_letter_agent(
    resume_summary: str,
    jd_analysis: JDAnalysis,
    candidate_name: str,
) -> str:
    jd_json = jd_analysis.model_dump_json(indent=2, exclude_none=True)
    prompt = (
        f"candidate_name: {candidate_name}\n\n"
        f"resume_summary:\n{resume_summary}\n\n"
        f"jd_analysis:\n{jd_json}"
    )

    raw = await _runner.run(prompt)
    return strip_code_fences(raw)

"""Google ADK agent: resume risk detector (weak spots + fixes)."""
from __future__ import annotations

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import MID_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.jd import JDAnalysis
from app.schemas.risks import ResumeRisks

SYSTEM_INSTRUCTION = load_prompt("resume_risks")


resume_risks_agent = Agent(
    name="resume_risks_agent",
    model=chat_model(MID_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    generate_content_config=types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.3,
    ),
)

_runner = AgentRunner(resume_risks_agent)


async def run_resume_risks(
    resume_text: str,
    jd_analysis: JDAnalysis,
) -> ResumeRisks:
    jd_json = jd_analysis.model_dump_json(indent=2, exclude_none=True)
    prompt = (
        "resume_text:\n"
        f"{resume_text.strip() or '(empty)'}\n\n"
        "jd_analysis:\n"
        f"{jd_json}"
    )

    data = await run_json(_runner, prompt)
    return ResumeRisks(**data)

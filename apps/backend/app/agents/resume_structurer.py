"""Google ADK agent that turns a finished resume's plain text into the
structured rendering contract (`StructuredResume`) consumed by the PDF
templates. It is a pure formatter — it must not change any wording.
"""
from __future__ import annotations

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import NANO_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.rendered_resume import StructuredResume

SYSTEM_INSTRUCTION = load_prompt("resume_structurer")


resume_structurer_agent = Agent(
    name="resume_structurer_agent",
    model=chat_model(NANO_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    output_schema=StructuredResume,
    # output_schema disables agent transfer; set explicitly so ADK doesn't warn.
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
    generate_content_config=types.GenerateContentConfig(temperature=0.0),
)

_runner = AgentRunner(resume_structurer_agent)


async def run_resume_structurer(resume_text: str, candidate_name: str) -> StructuredResume:
    prompt = (
        f"candidate_name: {candidate_name}\n\n"
        f"resume_text:\n{resume_text}"
    )
    data = await run_json(_runner, prompt)
    structured = StructuredResume(**data)
    # The candidate name is non-negotiable — fall back to the known name if the
    # model dropped it.
    if not structured.name.strip():
        structured.name = candidate_name
    return structured

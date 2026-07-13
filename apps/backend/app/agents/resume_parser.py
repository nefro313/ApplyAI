"""Google ADK agent that parses raw resume text into a structured ParsedResume."""
from __future__ import annotations

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import NANO_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.resume import ParsedResume

SYSTEM_INSTRUCTION = load_prompt("resume_parser")


resume_parser_agent = Agent(
    name="resume_parser_agent",
    model=chat_model(NANO_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    output_schema=ParsedResume,
    # output_schema disables agent transfer; set explicitly so ADK doesn't warn.
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
    generate_content_config=types.GenerateContentConfig(temperature=0.2),
)

_runner = AgentRunner(resume_parser_agent)


async def run_resume_parser(raw_text: str) -> ParsedResume:
    data = await run_json(_runner, raw_text)
    return ParsedResume(**data)

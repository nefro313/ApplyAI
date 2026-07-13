"""Google ADK agent that produces an interview-prep packet."""
from __future__ import annotations

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import MID_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.interview import InterviewPrep
from app.schemas.jd import JDAnalysis
from app.schemas.resume import ParsedResume

SYSTEM_INSTRUCTION = load_prompt("interview_prep")


# `output_schema` constrains Gemini to the InterviewPrep shape so it can't,
# e.g., drop question-objects into the `watch_outs` string list (a real failure
# the loose JSON mode produced).
interview_prep_agent = Agent(
    name="interview_prep_agent",
    model=chat_model(MID_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    output_schema=InterviewPrep,
    # output_schema disables agent transfer; set explicitly so ADK doesn't warn.
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
    generate_content_config=types.GenerateContentConfig(temperature=0.4),
)

_runner = AgentRunner(interview_prep_agent)


async def run_interview_prep(
    parsed_resume: ParsedResume,
    jd_analysis: JDAnalysis,
) -> InterviewPrep:
    resume_json = parsed_resume.model_dump_json(indent=2, exclude_none=True)
    jd_json = jd_analysis.model_dump_json(indent=2, exclude_none=True)
    prompt = f"RESUME:\n{resume_json}\n\nJD ANALYSIS:\n{jd_json}"

    data = await run_json(_runner, prompt)
    return InterviewPrep(**data)

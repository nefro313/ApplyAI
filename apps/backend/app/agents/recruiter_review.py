"""Google ADK agent: recruiter-perspective review of a tailored resume."""
from __future__ import annotations

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import MID_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.jd import JDAnalysis
from app.schemas.recruiter import RecruiterReview

SYSTEM_INSTRUCTION = load_prompt("recruiter_review")


recruiter_review_agent = Agent(
    name="recruiter_review_agent",
    model=chat_model(MID_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    generate_content_config=types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.3,
    ),
)

_runner = AgentRunner(recruiter_review_agent)


async def run_recruiter_review(
    resume_text: str,
    jd_analysis: JDAnalysis,
) -> RecruiterReview:
    jd_json = jd_analysis.model_dump_json(indent=2, exclude_none=True)
    prompt = (
        "resume_text:\n"
        f"{resume_text.strip() or '(empty)'}\n\n"
        "jd_analysis:\n"
        f"{jd_json}"
    )

    data = await run_json(_runner, prompt)
    return RecruiterReview(**data)

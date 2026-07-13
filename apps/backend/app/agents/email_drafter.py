"""Google ADK agent that drafts a job application email."""
from __future__ import annotations

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import NANO_MODEL, chat_model
from app.prompts import load_prompt

SYSTEM_INSTRUCTION = load_prompt("email_drafter")


email_drafter_agent = Agent(
    name="email_drafter_agent",
    model=chat_model(NANO_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    generate_content_config=types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.4,
    ),
)

_runner = AgentRunner(email_drafter_agent)


async def run_email_drafter(
    candidate_name: str,
    role_title: str,
    company_name: str,
    fit_summary: str,
) -> dict[str, str]:
    prompt = (
        f"candidate_name: {candidate_name}\n"
        f"role_title: {role_title}\n"
        f"company_name: {company_name}\n\n"
        f"fit_summary:\n{fit_summary}"
    )

    data = await run_json(_runner, prompt)

    if "subject" not in data or "body" not in data:
        raise ValueError("Email drafter response missing 'subject' or 'body'")

    return {"subject": str(data["subject"]), "body": str(data["body"])}

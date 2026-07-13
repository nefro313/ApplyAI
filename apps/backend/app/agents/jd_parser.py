"""Google ADK agent that parses a job description into structured data."""
from __future__ import annotations

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import NANO_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.jd import JDAnalysis

SYSTEM_INSTRUCTION = load_prompt("jd_parser")


jd_parser_agent = Agent(
    name="jd_parser_agent",
    model=chat_model(NANO_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    output_schema=JDAnalysis,
    # output_schema disables agent transfer; set explicitly so ADK doesn't warn.
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
    generate_content_config=types.GenerateContentConfig(temperature=0.2),
)

_runner = AgentRunner(jd_parser_agent)


async def run_jd_parser(
    jd_text: str,
    *,
    company_hint: str | None = None,
    role_hint: str | None = None,
) -> JDAnalysis:
    hint_lines: list[str] = []
    if company_hint and company_hint.strip():
        hint_lines.append(f"company_name: {company_hint.strip()}")
    if role_hint and role_hint.strip():
        hint_lines.append(f"role_title: {role_hint.strip()}")

    if hint_lines:
        prompt = (
            "User-provided hints (use these if the JD does not state them):\n"
            + "\n".join(hint_lines)
            + "\n\nJob description:\n"
            + jd_text
        )
    else:
        prompt = jd_text

    data = await run_json(_runner, prompt)
    analysis = JDAnalysis(**data)

    # The user knows their target role/company better than a scraped page —
    # let their explicit input win over whatever the parser pulled out.
    if company_hint and company_hint.strip():
        analysis.company_name = company_hint.strip()
    if role_hint and role_hint.strip():
        analysis.role_title = role_hint.strip()
    return analysis

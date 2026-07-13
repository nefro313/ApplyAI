"""Google ADK agent: skill-gap analysis + learning roadmap for a JD."""
from __future__ import annotations

import json
from typing import Any

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import MID_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.growth import SkillRoadmap
from app.schemas.jd import JDAnalysis

SYSTEM_INSTRUCTION = load_prompt("skill_roadmap")


skill_roadmap_agent = Agent(
    name="skill_roadmap_agent",
    model=chat_model(MID_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    generate_content_config=types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.4,
    ),
)

_runner = AgentRunner(skill_roadmap_agent)


async def run_skill_roadmap(
    jd_analysis: JDAnalysis,
    analyst_report: dict[str, Any],
    candidate_skills: list[str],
) -> SkillRoadmap:
    jd_json = jd_analysis.model_dump_json(indent=2, exclude_none=True)
    missing = analyst_report.get("missing_skills") or []
    matching = analyst_report.get("matching_skills") or []
    prompt = (
        f"jd_analysis:\n{jd_json}\n\n"
        f"analyst_report.missing_skills: {json.dumps(missing)}\n"
        f"analyst_report.matching_skills: {json.dumps(matching)}\n"
        f"candidate_skills: {json.dumps(candidate_skills)}"
    )

    data = await run_json(_runner, prompt)
    return SkillRoadmap(**data)

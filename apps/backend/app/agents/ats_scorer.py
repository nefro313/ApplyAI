"""Google ADK agent that produces a richer ATS scorecard for a resume vs JD.

Used by the orchestrator to score the **original** resume and the **tailored**
resume so the UI can show a before/after comparison. Distinct from
`app.tools.ats_scorer.score_resume`, which is deterministic and used inside
the resume_writer feedback loop.
"""
from __future__ import annotations

from google.adk.agents import Agent
from google.genai import types

from app.agents._common import AgentRunner, run_json
from app.core.constants import MID_MODEL, chat_model
from app.prompts import load_prompt
from app.schemas.ats import AtsAnalysis
from app.schemas.jd import JDAnalysis

SYSTEM_INSTRUCTION = load_prompt("ats_scorer")


# `output_schema` makes ADK pass a `response_schema` to Gemini so the model
# emits schema-constrained JSON. This eliminates the occasional malformed-JSON
# failures (missing commas / unescaped chars) the looser
# `response_mime_type="application/json"` mode produced on longer scorecards.
ats_scorer_agent = Agent(
    name="ats_scorer_agent",
    model=chat_model(MID_MODEL, json_output=True),
    instruction=SYSTEM_INSTRUCTION,
    output_schema=AtsAnalysis,
    # output_schema disables agent transfer; set explicitly so ADK doesn't warn.
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
    generate_content_config=types.GenerateContentConfig(temperature=0.1),
)

_runner = AgentRunner(ats_scorer_agent)


async def run_ats_scorer(
    resume_text: str,
    jd_analysis: JDAnalysis,
) -> AtsAnalysis:
    jd_json = jd_analysis.model_dump_json(indent=2, exclude_none=True)
    prompt = (
        "resume_text:\n"
        f"{resume_text.strip() or '(empty)'}\n\n"
        "jd_analysis:\n"
        f"{jd_json}"
    )

    data = await run_json(_runner, prompt)
    return AtsAnalysis(**data)

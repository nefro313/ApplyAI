"""Golden (resume, JD) pairs used by the eval suite.

These are kept here (not in conftest) so they can be imported by `pytest -m
eval` runs and by any ad-hoc evaluation script. Each pair captures a
*realistic* shape with enough signal that we can write meaningful
assertions on the agents' outputs.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EvalCase:
    name: str
    resume: str
    jd: str
    # --- quality expectations -----------------------------------------------
    expected_role_keywords: tuple[str, ...]
    expected_ats_keywords: tuple[str, ...]
    expected_candidate_name: str
    min_required_skills: int = 3
    min_ats_keywords: int = 5
    # Floor for the final ATS score after the writer + feedback loop.
    min_final_score: int = 70
    # Floor for the fraction of expected_ats_keywords appearing in the writer
    # output, case-insensitive.
    min_keyword_coverage: float = 0.6
    # Skills the JD mentions but the candidate genuinely lacks. The honest-
    # tailoring rules forbid the writer from claiming any of these, so they must
    # NOT appear in the tailored resume (anti-fabrication floor).
    forbidden_skills: tuple[str, ...] = ()


ML_ENG = EvalCase(
    name="ml_engineer_at_acme",
    resume="""Jane Doe
jane.doe@example.com | (555) 123-4567 | linkedin.com/in/janedoe

SUMMARY
Senior software engineer with 7 years of experience building production
systems in Python.

EXPERIENCE
Senior ML Engineer | Quantum Labs | 2021 - Present
- Built and shipped recommendation models serving 10M users on PyTorch and AWS
- Migrated training infrastructure to Kubernetes, cutting cycle time by 40%
- Led team of 4 engineers on LLM evaluation pipeline

Software Engineer | Datalink | 2018 - 2021
- Developed Python data ingestion services on GCP
- Maintained Docker-based CI/CD pipeline

SKILLS
Languages: Python, SQL, Go
Frameworks: PyTorch, TensorFlow, FastAPI
Tools: Docker, Kubernetes, AWS, GCP

EDUCATION
M.S. Computer Science | Stanford University | 2018
B.S. Computer Science | UC Berkeley | 2016
""",
    jd="""Senior Machine Learning Engineer at Acme AI

We are looking for an experienced ML engineer to join our team in San Francisco
(hybrid). You will design, build, and deploy production ML systems serving
millions of users.

Required:
- 5+ years of experience in machine learning or data science
- Strong proficiency in Python and PyTorch
- Experience with Kubernetes, Docker, and AWS or GCP
- Solid understanding of distributed systems
- Experience deploying LLMs in production

Nice to have:
- Experience with vector databases (Pinecone, Weaviate)
- Familiarity with LangChain and RAG architectures
- Background in MLOps (MLflow, Kubeflow)

Responsibilities:
- Design and implement scalable ML pipelines
- Optimize model serving infrastructure
- Mentor junior engineers
- Collaborate with product on feature ideation
""",
    expected_role_keywords=("Machine Learning", "ML"),
    expected_ats_keywords=(
        "Python",
        "PyTorch",
        "Kubernetes",
        "Docker",
        "AWS",
    ),
    expected_candidate_name="Jane Doe",
    # Jane's resume never mentions these JD nice-to-haves — the writer must not
    # fabricate them.
    forbidden_skills=("Pinecone", "Weaviate", "Kubeflow", "MLflow"),
)


BACKEND_ENG = EvalCase(
    name="backend_engineer_at_stripey",
    resume="""Alex Rivera
alex.rivera@example.com | (555) 987-6543 | github.com/arivera

SUMMARY
Backend engineer with 5 years of experience building distributed APIs in Go
and Python. Particular interest in payments, fraud, and reliability.

EXPERIENCE
Senior Backend Engineer | Mintly | 2022 - Present
- Led migration of a monolith to gRPC microservices on Kubernetes
- Reduced p99 latency on the checkout path from 1.2s to 320ms
- Built incident response runbook adopted across 4 product teams

Backend Engineer | Lumio | 2019 - 2022
- Designed and shipped a webhook delivery pipeline handling 50M events/day
- Implemented idempotency keys and at-least-once retry semantics
- Owned the on-call rotation for payments services

SKILLS
Languages: Go, Python, SQL
Infrastructure: Kubernetes, Terraform, AWS, PostgreSQL, Kafka
Observability: Prometheus, Grafana, OpenTelemetry

EDUCATION
B.S. Computer Engineering | University of Texas at Austin | 2019
""",
    jd="""Senior Backend Engineer at Stripey (Payments)

We are building the next generation of payments infrastructure and we are
hiring senior backend engineers in our New York office or remote (US).

Required:
- 5+ years of backend engineering experience
- Production experience with Go (or strong Java/Rust background and willingness
  to learn Go)
- Deep understanding of distributed systems: idempotency, retries, exactly-once
  semantics
- Strong SQL skills, comfortable with PostgreSQL at scale
- Experience operating services in production: on-call, incident response,
  observability

Nice to have:
- Payments domain experience
- Familiarity with Kafka or similar event streaming systems
- Experience with Kubernetes + Terraform

What you'll do:
- Build the core ledger and reconciliation system
- Design APIs that handle 100k+ requests per second
- Lead incident response and post-mortems
- Mentor engineers across the team
""",
    expected_role_keywords=("Backend", "Engineer"),
    expected_ats_keywords=(
        "Go",
        "PostgreSQL",
        "Kubernetes",
        "Kafka",
        "distributed systems",
    ),
    expected_candidate_name="Alex Rivera",
    # Alex works in Go/Python; the JD's alternative-language mentions must not be
    # claimed as his skills.
    forbidden_skills=("Rust",),
)


ALL_CASES: tuple[EvalCase, ...] = (ML_ENG, BACKEND_ENG)

"""Shared pytest fixtures.

Adds apps/backend to sys.path so tests can `from app.main import app` etc.
regardless of where pytest is invoked from.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture
def sample_jd_text() -> str:
    return """Senior Machine Learning Engineer at Acme AI

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
"""


@pytest.fixture
def sample_resume_text() -> str:
    return """Jane Doe
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
"""


@pytest.fixture
def mock_gcs_client() -> MagicMock:
    """Stand-in for `google.cloud.storage.Client` with bucket/blob chain."""
    blob = MagicMock()
    blob.upload_from_string = MagicMock()
    blob.upload_from_filename = MagicMock()
    blob.generate_signed_url = MagicMock(
        return_value="https://storage.example.com/signed-url"
    )

    bucket = MagicMock()
    bucket.blob = MagicMock(return_value=blob)

    client = MagicMock()
    client.bucket = MagicMock(return_value=bucket)
    return client

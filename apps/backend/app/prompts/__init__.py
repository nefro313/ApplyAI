"""Loads LLM system prompts from markdown files in this directory.

Prompts are kept in ``.md`` files (not Python strings) so they're easier to
read, diff, and iterate on without touching agent code. Files are read once
per process via ``lru_cache``; edit and restart to pick up changes.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent


@lru_cache
def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / f"{name}.md"
    if not path.is_file():
        raise FileNotFoundError(f"prompt not found: {path}")
    return path.read_text(encoding="utf-8").strip()

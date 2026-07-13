"""ATS scoring for tailored resumes."""
from __future__ import annotations

REQUIRED_SECTIONS: tuple[str, ...] = ("SUMMARY", "EXPERIENCE", "SKILLS", "EDUCATION")
SECTION_PENALTY = 5


def score_resume(resume_text: str, jd_keywords: list[str]) -> dict:
    resume_lower = resume_text.lower()

    matched: list[str] = []
    missing: list[str] = []
    for keyword in jd_keywords:
        if keyword and keyword.lower() in resume_lower:
            matched.append(keyword)
        else:
            missing.append(keyword)

    score = round(len(matched) / len(jd_keywords) * 100) if jd_keywords else 0

    section_check: dict[str, bool] = {
        section: section.lower() in resume_lower for section in REQUIRED_SECTIONS
    }

    missing_sections = sum(1 for present in section_check.values() if not present)
    penalty = missing_sections * SECTION_PENALTY
    final_score = max(0, score - penalty)

    return {
        "score": score,
        "matched_keywords": matched,
        "missing_keywords": missing,
        "section_check": section_check,
        "final_score": final_score,
    }

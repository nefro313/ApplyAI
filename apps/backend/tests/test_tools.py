"""Tool tests."""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse


async def test_scraper_returns_text_for_valid_url():
    from app.tools.scraper import scrape_jd

    # httpbin.org/html serves the Moby Dick excerpt — stable HTML, plenty of <p> tags.
    text = await scrape_jd("https://httpbin.org/html")

    assert text is not None
    assert len(text) > 100


async def test_scraper_returns_none_for_bad_url():
    from app.tools.scraper import scrape_jd

    text = await scrape_jd("http://this-domain-does-not-exist-xyz123.invalid/")
    assert text is None


def test_build_gmail_url_encodes_correctly():
    from app.tools.gmail import build_gmail_compose_url

    url = build_gmail_compose_url(
        to_email="hr@acme.com",
        subject="Application for Senior Engineer",
        body="Hello,\n\nThis is the body & a line break.",
    )

    parsed = urlparse(url)
    assert parsed.scheme == "https"
    assert parsed.netloc == "mail.google.com"
    assert parsed.path == "/mail/"

    qs = parse_qs(parsed.query)
    assert qs["view"] == ["cm"]
    assert qs["fs"] == ["1"]
    assert qs["to"] == ["hr@acme.com"]
    assert qs["su"] == ["Application for Senior Engineer"]
    assert qs["body"] == ["Hello,\n\nThis is the body & a line break."]

    # Special chars must be percent-encoded in the raw URL (not bare).
    assert "@" not in url.split("?", 1)[1].split("&to=", 1)[1].split("&", 1)[0]


_SAMPLE_RESUME = """Jane Doe
jane@example.com | (555) 123-4567 | linkedin.com/in/janedoe

SUMMARY
Senior engineer building production ML systems.

---
EXPERIENCE
Senior Engineer | Acme | 2020 - 2024
- Shipped Python services
- Migrated infra to Kubernetes

---
SKILLS
Languages: Python, Go
Tools: PyTorch, Kubernetes

---
EDUCATION
B.S. Computer Science | UC Berkeley | 2018
"""


def test_build_structured_resume_parses_sections():
    from app.tools.resume_render import build_structured_resume

    r = build_structured_resume(_SAMPLE_RESUME, "Jane Doe")

    assert r.name == "Jane Doe"
    # Contact line split into typed links.
    kinds = {ln.kind for ln in r.links}
    assert {"email", "phone", "linkedin"} <= kinds
    assert any(ln.url.startswith("mailto:") for ln in r.links)
    assert r.summary and "ML systems" in r.summary
    # Experience entry parsed from the pipe-delimited header + bullets.
    assert len(r.experience) == 1
    exp = r.experience[0]
    assert exp.company == "Acme"
    assert exp.role == "Senior Engineer"
    assert len(exp.bullets) == 2
    # Categorised skills.
    labels = {g.label for g in r.skills}
    assert {"Languages", "Tools"} <= labels
    # Education parsed.
    assert r.education and r.education[0].institution == "UC Berkeley"


def test_render_resume_html_all_templates():
    from app.tools.resume_render import (
        TEMPLATE_IDS,
        build_structured_resume,
        render_resume_html,
    )

    r = build_structured_resume(_SAMPLE_RESUME, "Jane Doe")
    for template_id in TEMPLATE_IDS:
        html = render_resume_html(r, template_id)
        assert html.startswith("<!doctype html>")
        assert "Jane Doe" in html
        assert "Senior Engineer" in html
        assert "Kubernetes" in html


def test_render_resume_html_escapes_content():
    from app.schemas.rendered_resume import StructuredResume
    from app.tools.resume_render import render_resume_html

    r = StructuredResume(name="Jane <script>alert(1)</script> Doe")
    html = render_resume_html(r, "classic")
    # Raw name must be HTML-escaped, never injected as live markup.
    assert "<script>" not in html
    assert "&lt;script&gt;" in html

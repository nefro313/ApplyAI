"""Render a `StructuredResume` into a styled PDF via an HTML/CSS template.

Three templates are available — ``classic`` (serif, blue accent, three-column
header), ``minimal`` (centered serif with an icon contact row) and ``modern``
(sans-serif, bold black headers). All three are single-column-body so they stay
ATS-friendly. PDFs are produced by rendering the HTML in the already-installed
Playwright Chromium and calling ``page.pdf()`` — no new system dependency.

`build_structured_resume` turns the writer's plain-text resume into the
structured contract deterministically (the writer emits a rigid pipe-delimited
format); the orchestrator prefers the LLM `resume_structurer` and falls back to
this parser when that fails.
"""
from __future__ import annotations

import html
import logging
import re

from app.schemas.rendered_resume import (
    ContactLink,
    ExtraSection,
    RenderEducation,
    RenderExperience,
    RenderProject,
    SkillGroup,
    StructuredResume,
)

logger = logging.getLogger(__name__)

TEMPLATE_IDS = ("classic", "minimal", "modern")
DEFAULT_TEMPLATE = "classic"

BULLET_PREFIXES = ("- ", "• ", "* ", "– ")
_KNOWN_HEADERS = {
    "SUMMARY",
    "EXPERIENCE",
    "WORK EXPERIENCE",
    "SKILLS",
    "EDUCATION",
    "PROJECTS",
    "CERTIFICATIONS",
    "ACTIVITIES",
    "PUBLICATIONS",
    "AWARDS",
}


# --------------------------------------------------------------------------- #
# Plain-text → StructuredResume (deterministic fallback)
# --------------------------------------------------------------------------- #
def _is_bullet(line: str) -> bool:
    return any(line.startswith(p) for p in BULLET_PREFIXES)


def _strip_bullet(line: str) -> str:
    for p in BULLET_PREFIXES:
        if line.startswith(p):
            return line[len(p):].strip()
    return line.strip()


def _classify_link(token: str) -> ContactLink:
    t = token.strip()
    low = t.lower()
    if "@" in t and " " not in t and "/" not in t:
        return ContactLink(label=t, url=f"mailto:{t}", kind="email")
    if re.fullmatch(r"[+()\-.\d\s]{7,}", t):
        digits = re.sub(r"[^+\d]", "", t)
        return ContactLink(label=t, url=f"tel:{digits}", kind="phone")
    if "linkedin" in low:
        return ContactLink(label=t, url=_with_scheme(t), kind="linkedin")
    if "github" in low:
        return ContactLink(label=t, url=_with_scheme(t), kind="github")
    return ContactLink(label=t, url=_with_scheme(t), kind="website")


def _with_scheme(url: str) -> str:
    u = url.strip()
    if u.startswith(("http://", "https://", "mailto:", "tel:")):
        return u
    return f"https://{u}"


def _split_skill_line(line: str) -> SkillGroup:
    if ":" in line:
        label, _, rest = line.partition(":")
        items = [s.strip() for s in re.split(r"[,;]", rest) if s.strip()]
        return SkillGroup(label=label.strip(), items=items)
    items = [s.strip() for s in re.split(r"[,;]", line) if s.strip()]
    return SkillGroup(label="", items=items)


def _parse_pipe_entry(line: str) -> list[str]:
    return [p.strip() for p in line.split("|")]


def _is_section_header(line: str) -> bool:
    return line.strip().upper().rstrip(":") in _KNOWN_HEADERS


def build_structured_resume(resume_text: str, candidate_name: str) -> StructuredResume:
    """Best-effort deterministic parse of the writer's plain-text resume.

    Header-driven rather than relying solely on ``---`` separators (the writer
    keeps the name/contact block and the SUMMARY heading in the same pre-``---``
    chunk): the name is the first line, contact lines follow until the first
    recognised section heading, then each known heading opens a section. Never
    raises — anything it can't classify lands in an extras section so no content
    is lost.
    """
    # Drop separator-only lines; keep everything else (preserving order).
    lines = [
        ln.strip() for ln in resume_text.splitlines() if ln.strip() != "---"
    ]
    resume = StructuredResume(name=candidate_name)

    idx, n = 0, len(lines)
    while idx < n and not lines[idx].strip():
        idx += 1
    if idx < n:
        resume.name = lines[idx].strip() or candidate_name
        idx += 1

    # Contact lines: everything up to the first recognised section heading.
    while idx < n:
        s = lines[idx].strip()
        if s and _is_section_header(s):
            break
        if s:
            for token in s.split("|"):
                if token.strip():
                    resume.links.append(_classify_link(token))
        idx += 1

    # Group the rest into (heading, body[]) blocks.
    sections: list[tuple[str, list[str]]] = []
    heading: str | None = None
    body: list[str] = []
    while idx < n:
        s = lines[idx].strip()
        if s and _is_section_header(s):
            if heading is not None:
                sections.append((heading, body))
            heading, body = s, []
        elif heading is not None and s:
            body.append(s)
        idx += 1
    if heading is not None:
        sections.append((heading, body))

    for raw_heading, sec_body in sections:
        name = raw_heading.upper().rstrip(":")
        if name == "SUMMARY":
            resume.summary = " ".join(sec_body).strip() or None
        elif name in ("EXPERIENCE", "WORK EXPERIENCE"):
            resume.experience.extend(_parse_experience(sec_body))
        elif name == "SKILLS":
            for line in sec_body:
                grp = _split_skill_line(line)
                if grp.items:
                    resume.skills.append(grp)
        elif name == "EDUCATION":
            resume.education.extend(_parse_education(sec_body))
        elif name == "PROJECTS":
            resume.projects.extend(_parse_projects(sec_body))
        else:
            resume.extras.append(
                ExtraSection(
                    heading=raw_heading.rstrip(":"),
                    bullets=[_strip_bullet(b) for b in sec_body],
                )
            )
    return resume


def _parse_experience(body: list[str]) -> list[RenderExperience]:
    entries: list[RenderExperience] = []
    current: RenderExperience | None = None
    for line in body:
        if _is_bullet(line):
            if current is not None:
                current.bullets.append(_strip_bullet(line))
            continue
        # New entry header: "Title | Company | Dates" (any of the pipes may be
        # missing).
        parts = _parse_pipe_entry(line)
        current = RenderExperience(
            role=parts[0] or None,
            company=parts[1] if len(parts) > 1 else (parts[0] or ""),
            end_date=parts[2] if len(parts) > 2 else None,
        )
        # When only one field is present, treat it as the company.
        if len(parts) == 1:
            current.company = parts[0]
            current.role = None
        entries.append(current)
    return entries


def _parse_education(body: list[str]) -> list[RenderEducation]:
    entries: list[RenderEducation] = []
    current: RenderEducation | None = None
    for line in body:
        if _is_bullet(line) and current is not None:
            current.details.append(_strip_bullet(line))
            continue
        parts = _parse_pipe_entry(line)
        current = RenderEducation(
            degree=parts[0] or None,
            institution=parts[1] if len(parts) > 1 else (parts[0] or ""),
            end_date=parts[2] if len(parts) > 2 else None,
        )
        if len(parts) == 1:
            current.institution = parts[0]
            current.degree = None
        entries.append(current)
    return entries


def _parse_projects(body: list[str]) -> list[RenderProject]:
    entries: list[RenderProject] = []
    current: RenderProject | None = None
    for line in body:
        if _is_bullet(line) and current is not None:
            current.bullets.append(_strip_bullet(line))
            continue
        if ":" in line:
            name, _, desc = line.partition(":")
            current = RenderProject(name=name.strip())
            if desc.strip():
                current.bullets.append(desc.strip())
        else:
            current = RenderProject(name=line.strip())
        entries.append(current)
    return entries


# --------------------------------------------------------------------------- #
# HTML rendering
# --------------------------------------------------------------------------- #
def _e(text: str | None) -> str:
    return html.escape(text or "")


# Tiny inline SVGs (16x16) used by the minimal/modern contact rows.
_ICONS = {
    "email": '<path d="M2 4h12v8H2z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 4l6 4 6-4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    "phone": '<path d="M3 3c0 6 4 10 10 10l-1.5-2.5-2.5 1A8 8 0 0 1 4.5 7l1-2.5L3 3z" fill="currentColor"/>',
    "website": '<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1.7 8h12.6M8 1.7c2 2 2 10.6 0 12.6M8 1.7c-2 2-2 10.6 0 12.6" fill="none" stroke="currentColor" stroke-width="1.1"/>',
    "github": '<path d="M8 1a7 7 0 0 0-2.2 13.6c.35.06.48-.15.48-.34v-1.2c-1.95.42-2.36-.94-2.36-.94-.32-.8-.78-1.02-.78-1.02-.64-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.63 1.07 1.64.76 2.04.58.06-.45.25-.76.45-.94-1.56-.18-3.2-.78-3.2-3.46 0-.76.27-1.39.72-1.88-.07-.18-.31-.9.07-1.87 0 0 .59-.19 1.93.72a6.7 6.7 0 0 1 3.5 0c1.34-.91 1.93-.72 1.93-.72.38.97.14 1.69.07 1.87.45.49.72 1.12.72 1.88 0 2.69-1.64 3.28-3.2 3.45.25.22.48.66.48 1.33v1.97c0 .19.13.4.49.34A7 7 0 0 0 8 1z" fill="currentColor"/>',
    "linkedin": '<path d="M3.4 6.2h2v6.4h-2zM4.4 2.9a1.16 1.16 0 1 1 0 2.32 1.16 1.16 0 0 1 0-2.32zM7 6.2h1.9v.9h.03c.27-.5.92-1.03 1.9-1.03 2.03 0 2.4 1.34 2.4 3.07v3.49h-2V9.6c0-.72-.01-1.64-1-1.64-1 0-1.15.78-1.15 1.59v3.07H7z" fill="currentColor"/>',
    "other": '<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.2"/>',
}


def _icon_svg(kind: str) -> str:
    path = _ICONS.get(kind, _ICONS["other"])
    return (
        f'<svg viewBox="0 0 16 16" width="11" height="11" '
        f'style="vertical-align:-1px;margin-right:4px">{path}</svg>'
    )


def _bullets_html(bullets: list[str]) -> str:
    if not bullets:
        return ""
    items = "".join(f"<li>{_e(b)}</li>" for b in bullets)
    return f"<ul>{items}</ul>"


def _dates(start: str | None, end: str | None) -> str:
    if start and end:
        return f"{_e(start)} – {_e(end)}"
    return _e(end or start)


def _experience_html(entries: list[RenderExperience], *, company_first: bool) -> str:
    rows = []
    for x in entries:
        primary = x.company if company_first else (x.role or x.company)
        secondary = (x.role or "") if company_first else x.company
        rows.append(
            f'<div class="entry">'
            f'<div class="entry-head">'
            f'<span class="entry-title">{_e(primary)}</span>'
            f'<span class="entry-date">{_dates(x.start_date, x.end_date)}</span>'
            f"</div>"
            f'<div class="entry-sub">'
            f'<span class="entry-org">{_e(secondary)}</span>'
            f'<span class="entry-loc">{_e(x.location)}</span>'
            f"</div>"
            f"{_bullets_html(x.bullets)}"
            f"</div>"
        )
    return "".join(rows)


def _education_html(entries: list[RenderEducation]) -> str:
    rows = []
    for ed in entries:
        rows.append(
            f'<div class="entry">'
            f'<div class="entry-head">'
            f'<span class="entry-title">{_e(ed.degree or ed.institution)}</span>'
            f'<span class="entry-date">{_dates(ed.start_date, ed.end_date)}</span>'
            f"</div>"
            f'<div class="entry-sub">'
            f'<span class="entry-org">{_e(ed.institution if ed.degree else "")}</span>'
            f'<span class="entry-loc">{_e(ed.location)}</span>'
            f"</div>"
            f"{_bullets_html(ed.details)}"
            f"</div>"
        )
    return "".join(rows)


def _projects_html(entries: list[RenderProject]) -> str:
    rows = []
    for p in entries:
        link = ""
        if p.link:
            link = f'<a class="entry-date" href="{_e(p.link.url)}">{_e(p.link.label)}</a>'
        rows.append(
            f'<div class="entry">'
            f'<div class="entry-head">'
            f'<span class="entry-title">{_e(p.name)}</span>{link}'
            f"</div>"
            f"{_bullets_html(p.bullets)}"
            f"</div>"
        )
    return "".join(rows)


def _skills_html(groups: list[SkillGroup], *, as_table: bool) -> str:
    if as_table:
        rows = []
        for g in groups:
            if g.label:
                rows.append(
                    f'<tr><td class="sk-label">{_e(g.label)}</td>'
                    f'<td class="sk-val">{_e(", ".join(g.items))}</td></tr>'
                )
            else:
                rows.append(
                    f'<tr><td class="sk-label"></td>'
                    f'<td class="sk-val">{_e(", ".join(g.items))}</td></tr>'
                )
        return f'<table class="skills">{"".join(rows)}</table>'
    parts = []
    for g in groups:
        if g.label:
            parts.append(
                f'<div class="sk-row"><strong>{_e(g.label)}:</strong> '
                f"{_e(', '.join(g.items))}</div>"
            )
        else:
            parts.append(f'<div class="sk-row">{_e(", ".join(g.items))}</div>')
    return "".join(parts)


def _extras_html(extras: list[ExtraSection], section_fn) -> str:
    return "".join(
        section_fn(ex.heading, _bullets_html(ex.bullets)) for ex in extras
    )


def _contact_row(links: list[ContactLink], location: str | None) -> str:
    """Centered icon contact row (minimal/modern)."""
    chips = []
    if location:
        chips.append(f'<span class="chip">{_icon_svg("website")}{_e(location)}</span>')
    for ln in links:
        chips.append(
            f'<a class="chip" href="{_e(ln.url)}">{_icon_svg(ln.kind)}{_e(ln.label)}</a>'
        )
    sep = '<span class="sep">|</span>'
    return sep.join(chips)


# ---- template: classic ---------------------------------------------------- #
def _render_classic(r: StructuredResume) -> str:
    left = []
    if r.location:
        left.append(_e(r.location))
    for ln in r.links:
        if ln.kind in ("email", "phone"):
            left.append(_e(ln.label))
    right = [
        f'<a href="{_e(ln.url)}">{_e(ln.label)}</a>'
        for ln in r.links
        if ln.kind not in ("email", "phone")
    ]

    def section(title: str, inner: str) -> str:
        if not inner:
            return ""
        return f'<h2>{_e(title)}</h2>{inner}'

    body = []
    if r.summary:
        body.append(f'<p class="summary">{_e(r.summary)}</p>')
    body.append(section("Skills", _skills_html(r.skills, as_table=True)))
    body.append(section("Experience", _experience_html(r.experience, company_first=False)))
    body.append(section("Projects", _projects_html(r.projects)))
    body.append(section("Education", _education_html(r.education)))
    body.append(_extras_html(r.extras, section))

    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{_BASE_CSS}
body {{ font-family: Georgia, 'Times New Roman', serif; color:#222; }}
.header {{ display:flex; align-items:flex-start; gap:12px; margin-bottom:10px; }}
.header .col-l {{ flex:1; font-size:8.5pt; color:#555; line-height:1.5; }}
.header .col-c {{ flex:1.4; text-align:center; }}
.header .col-r {{ flex:1; text-align:right; font-size:8.5pt; line-height:1.5; }}
.header .col-r a {{ color:#2a6db0; display:block; text-decoration:none; }}
.name {{ font-size:21pt; font-weight:bold; color:#1a1a2e; line-height:1.1; }}
.headline {{ font-size:11pt; color:#2a6db0; margin-top:2px; }}
h2 {{ font-size:10.5pt; text-transform:uppercase; letter-spacing:1px; color:#2a6db0;
     border-bottom:1px solid #2a6db0; padding-bottom:2px; margin:12px 0 6px; }}
.summary {{ margin:4px 0 0; }}
.entry-title {{ font-weight:bold; }}
.entry-org {{ font-style:italic; }}
.entry-loc {{ font-style:italic; color:#555; }}
table.skills td {{ vertical-align:top; padding:1px 0; }}
table.skills .sk-label {{ font-weight:bold; white-space:nowrap; padding-right:12px; width:1%; }}
</style></head><body>
<div class="header">
  <div class="col-l">{"<br>".join(left)}</div>
  <div class="col-c"><div class="name">{_e(r.name)}</div>
    {f'<div class="headline">{_e(r.headline)}</div>' if r.headline else ''}</div>
  <div class="col-r">{"".join(right)}</div>
</div>
{"".join(body)}
</body></html>"""


# ---- template: minimal (Lato, blue small-caps headers, two-column header) -- #
def _minimal_skills_html(groups: list[SkillGroup]) -> str:
    rows = []
    for g in groups:
        if not g.items:
            continue
        rows.append(
            f'<tr><td class="lbl">{_e(g.label)}</td>'
            f'<td class="colon">{":" if g.label else ""}</td>'
            f'<td>{_e(", ".join(g.items))}</td></tr>'
        )
    return f'<table class="skills">{"".join(rows)}</table>' if rows else ""


def _render_minimal(r: StructuredResume) -> str:
    profile_links = [ln for ln in r.links if ln.kind not in ("email", "phone")]
    email = next((ln for ln in r.links if ln.kind == "email"), None)
    phone = next((ln for ln in r.links if ln.kind == "phone"), None)

    links_line = ' <span class="bar">|</span> '.join(
        f'<a href="{_e(ln.url)}">{_e(ln.label)}</a>' for ln in profile_links
    )
    right_lines = []
    if r.location:
        right_lines.append(f"<div>Location: {_e(r.location)}</div>")
    em_parts = []
    if email:
        em_parts.append(f'Email: <a href="{_e(email.url)}">{_e(email.label)}</a>')
    if phone:
        em_parts.append(f"Mobile: {_e(phone.label)}")
    if em_parts:
        right_lines.append("<div>" + ' <span class="bar">|</span> '.join(em_parts) + "</div>")

    def section(title: str, inner: str) -> str:
        if not inner:
            return ""
        return f"<h2>{_e(title)}</h2>{inner}"

    body = []
    # Headline renders as the first section (header + rule), with the summary
    # as its body — matching the reference.
    if r.headline:
        body.append(
            f"<h2>{_e(r.headline)}</h2>"
            + (f"<p>{_e(r.summary)}</p>" if r.summary else "")
        )
    elif r.summary:
        body.append(section("Summary", f"<p>{_e(r.summary)}</p>"))
    body.append(section("Technical Skills", _minimal_skills_html(r.skills)))
    body.append(section("Experience", _experience_html(r.experience, company_first=False)))
    body.append(section("Education", _education_html(r.education)))
    body.append(section("Projects", _projects_html(r.projects)))
    body.append(_extras_html(r.extras, section))

    return f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
<style>
{_BASE_CSS}
body {{ font-family:'Lato','Helvetica Neue',Arial,sans-serif; color:#000; font-size:10pt; }}
.head {{ display:flex; justify-content:space-between; align-items:flex-end; gap:16px; }}
.head .left {{ min-width:0; }}
.name {{ font-size:26pt; font-weight:900; line-height:1; letter-spacing:.3px; }}
.links {{ margin-top:5px; font-size:10.5pt; }}
.links a, .right a {{ color:#000; text-decoration:underline; }}
.bar {{ color:#000; }}
.right {{ text-align:right; font-size:10pt; line-height:1.55; white-space:nowrap; }}
h2 {{ color:#0000FF; font-variant:small-caps; letter-spacing:1px;
     font-weight:700; font-size:13pt; border-bottom:1px solid #000; padding-bottom:1px;
     margin:13px 0 6px; }}
.entry-title {{ font-weight:700; }}
.entry-org {{ font-style:italic; }}
.entry-loc {{ font-style:italic; }}
table.skills td {{ vertical-align:top; padding:1px 0; }}
table.skills .lbl {{ font-weight:700; white-space:nowrap; padding-right:4px; }}
table.skills .colon {{ padding-right:10px; }}
</style></head><body>
<div class="head">
  <div class="left">
    <div class="name">{_e(r.name)}</div>
    <div class="links">{links_line}</div>
  </div>
  <div class="right">{"".join(right_lines)}</div>
</div>
{"".join(body)}
</body></html>"""


# ---- template: modern ----------------------------------------------------- #
def _render_modern(r: StructuredResume) -> str:
    def section(title: str, inner: str) -> str:
        if not inner:
            return ""
        return f'<h2>{_e(title)}</h2>{inner}'

    body = []
    if r.summary:
        body.append(section("Summary", f'<p class="summary">{_e(r.summary)}</p>'))
    body.append(section("Experience", _experience_html(r.experience, company_first=True)))
    body.append(section("Projects", _projects_html(r.projects)))
    body.append(section("Education", _education_html(r.education)))
    body.append(section("Skills", _skills_html(r.skills, as_table=False)))
    body.append(_extras_html(r.extras, section))

    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{_BASE_CSS}
body {{ font-family:'Helvetica Neue', Arial, sans-serif; color:#222; font-size:10pt; }}
.name {{ text-align:center; font-size:22pt; font-weight:800; letter-spacing:.5px; color:#111; }}
.contact {{ text-align:center; font-size:9pt; color:#444; margin:6px 0 2px; }}
.contact a {{ color:#444; text-decoration:none; }}
.contact .chip {{ white-space:nowrap; }}
.contact .sep {{ color:#ccc; margin:0 7px; }}
h2 {{ font-size:11pt; text-transform:uppercase; letter-spacing:1px; font-weight:800; color:#111;
     border-bottom:2px solid #222; padding-bottom:3px; margin:13px 0 6px; }}
.entry-title {{ font-weight:bold; }}
.entry-date {{ color:#666; }}
.entry-org {{ font-style:italic; }}
.entry-loc {{ font-style:italic; color:#666; }}
.sk-row {{ margin:2px 0; }}
</style></head><body>
<div class="name">{_e(r.name)}</div>
<div class="contact">{_contact_row(r.links, r.location)}</div>
{"".join(body)}
</body></html>"""


# Shared CSS: A4 page geometry, entry header layout, list styling.
_BASE_CSS = """
* { box-sizing: border-box; }
@page { size: A4; margin: 14mm 15mm; }
html, body { margin:0; padding:0; }
body { font-size: 10pt; line-height: 1.4; }
a { color: inherit; }
p { margin: 0 0 4px; }
ul { margin: 3px 0 6px; padding-left: 16px; }
li { margin: 1.5px 0; }
.entry { margin: 0 0 8px; page-break-inside: avoid; }
.entry-head, .entry-sub { display:flex; justify-content:space-between; gap:10px; }
.entry-sub { font-size: 9.5pt; }
.headline { }
"""

_RENDERERS = {
    "classic": _render_classic,
    "minimal": _render_minimal,
    "modern": _render_modern,
}


def render_resume_html(structured: StructuredResume, template_id: str) -> str:
    fn = _RENDERERS.get(template_id, _RENDERERS[DEFAULT_TEMPLATE])
    return fn(structured)


async def html_to_pdf(page_html: str, output_path: str) -> str:
    """Render an HTML string to an A4 PDF at ``output_path`` via headless
    Chromium. Shared by the resume and cover-letter renderers."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.set_content(page_html, wait_until="networkidle")
            # Make sure any web fonts (e.g. Lato in the minimal template) are
            # fully loaded before we snapshot to PDF.
            try:
                await page.evaluate("document.fonts.ready")
            except Exception:  # pragma: no cover - non-fatal best effort
                pass
            await page.pdf(
                path=output_path,
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
            )
        finally:
            await browser.close()
    return output_path


async def render_resume_pdf(
    structured: StructuredResume, template_id: str, output_path: str
) -> str:
    """Render the structured resume to a PDF at ``output_path`` via Chromium."""
    return await html_to_pdf(render_resume_html(structured, template_id), output_path)

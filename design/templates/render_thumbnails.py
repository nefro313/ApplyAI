"""Regenerate the resume-template preview thumbnails from a fully-filled sample.

Renders all three templates to PDF, which you then rasterize into the picker
thumbnails under apps/frontend/public/templates/.

Usage (from apps/backend/):
    PYTHONPATH=. .venv/bin/python ../../design/templates/render_thumbnails.py
    for t in classic minimal modern; do \\
        pdftoppm -png -r 96 -singlefile /tmp/full_$t.pdf \\
        ../frontend/public/templates/$t; done
"""
import asyncio

from app.tools.resume_render import build_structured_resume, render_resume_pdf

# A fully fleshed-out resume that exercises every section the templates support.
SAMPLE = """Jordan Avery
jordan.avery@email.com | +1 (415) 555-0182 | jordanavery.dev | linkedin.com/in/jordanavery | github.com/jordanavery

SUMMARY
Full-stack software engineer with 5+ years building and shipping production web applications and ML-powered features. Strong across the stack — from React front-ends to Python/Node services and cloud deployment on AWS. Comfortable owning features end to end, mentoring teammates, and turning ambiguous requirements into reliable, well-tested software.

EXPERIENCE
Senior Software Engineer | Northwind Labs | Mar 2022 - Present
- Led the rebuild of the customer dashboard in React and TypeScript, cutting page load time by 42% and lifting weekly active users by 18%
- Designed and shipped a real-time notifications service in Node.js and WebSockets handling 12M events/day with 99.95% uptime
- Introduced end-to-end testing with Playwright and a CI pipeline in GitHub Actions, reducing production incidents by 35%
- Mentored 4 engineers and ran the team's weekly architecture and code-review sessions

Software Engineer | BrightPixel | Jun 2019 - Feb 2022
- Built RESTful and GraphQL APIs in Python (FastAPI) serving 30+ internal and partner integrations
- Migrated a monolith to containerized microservices on AWS ECS, improving deploy frequency from weekly to daily
- Implemented a recommendation feature with scikit-learn that increased average order value by 11%

Junior Developer | Cobalt Studio | Jul 2018 - May 2019
- Developed responsive marketing sites in React and Next.js for 15+ clients
- Automated image optimization and asset bundling, cutting average build size by 28%

SKILLS
Languages: JavaScript, TypeScript, Python, SQL, Go
Frameworks: React, Next.js, Node.js, FastAPI, Express
Cloud & DevOps: AWS (ECS, S3, Lambda), Docker, Kubernetes, GitHub Actions, Terraform
Databases: PostgreSQL, MongoDB, Redis
Tools: Git, Playwright, Jest, Datadog, Figma

PROJECTS
DevBoard: Open-source Kanban board built with React, Node.js, and PostgreSQL; 1.2k GitHub stars and 40+ contributors.
MarketPulse: Real-time stock dashboard using WebSockets and Redis pub/sub, deployed on AWS Lambda with sub-100ms updates.

EDUCATION
B.S. Computer Science | University of California, Berkeley | Aug 2014 - May 2018

CERTIFICATIONS
- AWS Certified Solutions Architect - Associate
- MongoDB Certified Developer
- Meta Front-End Developer Professional Certificate
"""


async def main():
    r = build_structured_resume(SAMPLE, "Jordan Avery")
    r.headline = "Full-Stack Software Engineer"
    r.location = "San Francisco, CA"
    for tid in ("classic", "minimal", "modern"):
        await render_resume_pdf(r, tid, f"/tmp/full_{tid}.pdf")
        print("rendered", tid)


asyncio.run(main())

# syntax=docker/dockerfile:1.7

# Stage 1 — install deps into a venv with uv (cached on pyproject/uv.lock)
# Pinned to bookworm: Playwright's --with-deps step tries Ubuntu-only font
# packages on Debian 13 (trixie) and fails, so stay on bookworm.
FROM python:3.13-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /uvx /bin/

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_NO_PROGRESS=1

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev \
    || uv sync --no-install-project --no-dev

# Stage 2 — runtime: venv + Chromium (used by the scraper and PDF renderer)
FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv

RUN playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# Run as a non-root user. Chromium and the venv live in root-owned, world-
# readable dirs (default perms), so the app user can still execute them; it just
# can't write outside its own home/tmp.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser
ENV HOME=/home/appuser

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

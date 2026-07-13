# ApplyAI

Job-application automation. Drop in a resume + a job description, and a chain of Gemini agents (parser → analyst → writer with ATS feedback loop → cover letter → email) hand back a tailored PDF, DOCX, optional cover letter, and a ready-to-send Gmail draft.

## Architecture

A FastAPI backend orchestrates seven Google ADK agents — JD parser, resume parser, resume analyst, resume writer (with an ATS feedback loop on `gemini-2.5-pro`), cover-letter writer, email drafter, plus tools for scraping (httpx → Playwright fallback), LlamaParse-based document parsing, ReportLab/python-docx export, and ATS scoring. Files live in Google Cloud Storage; per-pipeline state and progress live in Firestore. Long pipelines run as `BackgroundTasks` and stream live status to the Next.js 16 frontend over Server-Sent Events.

## Prerequisites

- Docker Desktop (or Docker + Compose v2)
- A Google Cloud project with billing enabled
- A service-account JSON key with access to Cloud Storage and Firestore
- A Gemini API key from Google AI Studio

## GCP setup (one-time)

1. **Create or pick a project** at https://console.cloud.google.com/.
2. **Enable APIs.** From the project's API library, enable:
   - Cloud Storage API
   - Cloud Firestore API
   - Vertex AI API *(only if you switch agents to use Vertex routing)*
3. **Create a Cloud Storage bucket** (any region). Note the name — it becomes `GCS_BUCKET_NAME`.
4. **Initialise Firestore** in *Native* mode (not Datastore mode).
5. **Create a service account.** IAM → Service Accounts → Create:
   - Roles: `Storage Object Admin`, `Cloud Datastore User` (or Firestore equivalents).
   - Keys → Add key → JSON → download.
6. **Get a Gemini API key** at https://aistudio.google.com/apikey.

## Local setup

```bash
git clone <repo-url> applyai
cd applyai
./scripts/setup.sh
```

The script copies `.env.example` files into place and prompts you to fill them in. After that:

1. Open `apps/backend/.env` and set:
   - `GOOGLE_CLOUD_PROJECT`
   - `GCS_BUCKET_NAME`
   - `GEMINI_API_KEY`
   - `LlamaIndex_API_KEY`
2. Save the service-account JSON at `apps/backend/credentials/service-account.json` (matches the default `GOOGLE_APPLICATION_CREDENTIALS` in the example).
3. Adjust `apps/frontend/.env.local` only if you need a non-default `NEXT_PUBLIC_API_URL`.
4. Run from `infrastructure/docker/`:

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:8001
- Health:   http://localhost:8001/health

Both services hot-reload — the host directories are mounted into the containers.

## Layout

```
.
├── apps/
│   ├── backend/                    FastAPI service (uv-managed)
│   │   ├── app/
│   │   │   ├── agents/             ADK agents
│   │   │   ├── api/v1/endpoints/   health, upload, jobs, email, pipeline
│   │   │   ├── api/v1/router.py    aggregates v1 endpoints
│   │   │   ├── core/               config, constants, gcp clients
│   │   │   ├── schemas/            Pydantic models
│   │   │   ├── tools/              scraper, ats_scorer, document_builder, gmail
│   │   │   ├── prompts/            agent system prompts (.md)
│   │   │   └── main.py             FastAPI app, mounts /api/v1
│   │   └── tests/                  pytest suite
│   └── frontend/                   Next.js 16 App Router + Tailwind + framer-motion
│       └── src/
│           ├── app/                routes
│           ├── components/         feature components + ui primitives
│           ├── services/api.ts     typed API client (/api/v1/...)
│           └── lib/utils.ts        shadcn cn() helper
├── packages/
│   └── types/                      @applyai/types — shared TS types (workspace)
├── infrastructure/
│   └── docker/                     backend.Dockerfile, frontend.Dockerfile, docker-compose.yml
├── scripts/                        setup helpers
├── package.json                    root npm workspace
└── README.md
```

## Running locally without Docker

**Backend:** (requires [uv](https://docs.astral.sh/uv/))
```bash
cd apps/backend
uv sync
uv run playwright install chromium
uv run uvicorn app.main:app --reload
```

**Frontend:**
```bash
npm install                    # from repo root, sets up workspaces
npm run frontend:dev           # or: cd apps/frontend && npm run dev
```

## Testing

```bash
cd apps/backend
uv run pytest -q                            # offline-safe + LLM (skipped without key)
GEMINI_API_KEY=… uv run pytest -q           # full suite, hits real Gemini

# Frontend typecheck
npm run frontend:typecheck                  # from repo root
```

## Endpoints

- `GET  /health` — liveness check (unversioned)
- `POST /api/v1/upload-resume` — multipart, returns `file_id`
- `POST /api/v1/scrape-jd` — `{url}` → `{success, jd_text, message}`
- `POST /api/v1/pipeline/start` — kicks off the agent chain, returns `pipeline_id`
- `GET  /api/v1/pipeline/{id}/status` — `PipelineProgress`
- `GET  /api/v1/pipeline/{id}/result` — `PipelineResult` (404 until done)
- `GET  /api/v1/pipeline/{id}/stream` — SSE: one frame per `(step, state)` transition
- `POST /api/v1/draft-email` — drafts an application email and returns a Gmail compose URL

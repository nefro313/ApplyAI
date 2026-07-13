# Deployment — Hostinger VPS

Traefik v3 edge proxy (auto Let's Encrypt TLS) in front of the FastAPI backend
(port **8001**, Playwright/Chromium baked in) and the Next.js frontend
(**standalone** Node server, port **3000**).

```
Browser ──https──> Traefik (443, TLS)
   ├── ${FRONTEND_DOMAIN}  ──> frontend (Next.js :3000)
   └── ${BACKEND_DOMAIN}   ──> backend  (FastAPI  :8001)
```

The browser calls the backend directly at `https://${BACKEND_DOMAIN}` (CORS is
locked to the frontend origin via `ALLOWED_ORIGINS`).

## Files

| Path | Purpose |
|------|---------|
| `apps/backend/Dockerfile` | Multi-stage uv build + Chromium runtime (port 8001) |
| `apps/frontend/Dockerfile` | 3-stage Next.js standalone build (**context = repo root**) |
| `infrastructure/docker/docker-compose.prod.yml` | Traefik + backend + frontend |
| `infrastructure/docker/docker-compose.dev.yml` | Local hot-reload stack (no Traefik) |
| `infrastructure/docker/.env.prod` | Prod env (gitignored — fill in on the VPS) |

> The older `backend.Dockerfile` / `frontend.Dockerfile` / `docker-compose.yml`
> in this folder are the previous single-stage setup, superseded by the above.

## First deploy

1. **DNS** — point both A-records at the VPS IP:
   ```
   applyai.robinkphilip.com          A   <vps-ip>
   applyai-backend.robinkphilip.com  A   <vps-ip>
   ```
2. **Firewall** — open ports 80 and 443 (80 is needed for the TLS challenge / redirect).
3. **Env** — copy `.env.prod`, fill in real values (Firebase, Gemini, LlamaIndex,
   GCS bucket, ACME email, domains).
4. **GCP creds** — place the service-account JSON at `apps/backend/service-account.json`
   (it is bind-mounted read-only; never baked into the image).
5. **Up:**
   ```bash
   cd infrastructure/docker
   docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
   docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f traefik   # watch cert issuance
   ```

First request to each domain triggers cert issuance (a few seconds), then you're on HTTPS.

## Local dev

```bash
cd infrastructure/docker
docker compose -f docker-compose.dev.yml up --build
# backend  -> http://localhost:8001
# frontend -> http://localhost:3000
```

Reads `apps/backend/.env` and `apps/frontend/.env.local` (both optional, gitignored).

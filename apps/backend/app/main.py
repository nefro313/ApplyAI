import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.api.v1.endpoints import health
from app.api.v1.router import api_router as api_v1_router
from app.core.config import settings  # noqa: F401  (import for env propagation side-effect)

logger = logging.getLogger(__name__)

# Sent on every response. HSTS is only meaningful over HTTPS (Traefik terminates
# TLS in front of us); harmless on the plain-HTTP dev port.
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for key, value in _SECURITY_HEADERS.items():
            response.headers.setdefault(key, value)
        return response


def _init_langsmith_tracing() -> None:
    """Best-effort init for LangSmith tracing of ADK agents.

    Skipped silently when LANGSMITH_TRACING is not enabled, or when the
    SDK can't patch (e.g. version mismatch). Never blocks app startup.
    """
    try:
        # langsmith wraps several ADK patch targets, each guarded independently;
        # the MCP target is skipped automatically when google-adk's optional
        # `mcp` extra isn't installed (we don't use MCP tools).
        from langsmith.integrations.google_adk import configure_google_adk

        configure_google_adk()
        logger.info("LangSmith tracing configured")
    except Exception as exc:  # pragma: no cover — tracing must never break the app
        logger.warning("LangSmith tracing not configured: %s", exc)


_init_langsmith_tracing()

app = FastAPI(title="ApplyAI API", version="0.1.0")

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts_list,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health.router)
app.include_router(api_v1_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)

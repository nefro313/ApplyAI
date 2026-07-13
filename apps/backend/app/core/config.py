import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_cloud_project: str = ""
    google_application_credentials: str = ""
    gcs_bucket_name: str = ""
    firestore_collection: str = "applyai_sessions"
    gemini_api_key: str = ""
    # Used by the ADK agents, which run on chat models via LiteLLM. Groq is the
    # primary provider; OpenAI is the fallback used only when groq_api_key is empty.
    groq_api_key: str = ""
    openai_api_key: str = ""
    llamaindex_api_key: str = ""
    allowed_origins: str = "http://localhost:3000"
    # Comma-separated Host values accepted by TrustedHostMiddleware. "*" = any
    # (fine for local dev). In prod set to the backend domain(s).
    trusted_hosts: str = "*"

    firebase_project_id: str = ""
    # When empty, falls back to GOOGLE_APPLICATION_CREDENTIALS (same JSON used by GCP clients).
    firebase_credentials_path: str = ""
    # Set to "1" to bypass Firebase token verification in local dev — never enable in prod.
    auth_dev_bypass: str = ""
    # "development" | "production". When "production", a set auth_dev_bypass aborts startup.
    app_env: str = "development"

    langsmith_tracing: str = ""
    langsmith_endpoint: str = ""
    langsmith_api_key: str = ""
    langsmith_project: str = ""

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def trusted_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()] or ["*"]


def _propagate_to_environ(s: Settings) -> None:
    """Push selected settings into ``os.environ`` for libraries (google-genai,
    google-cloud-*) that read directly from environment variables. Uses
    ``setdefault`` so an OS-level env var always wins over .env.
    """
    if s.gemini_api_key:
        os.environ.setdefault("GEMINI_API_KEY", s.gemini_api_key)
        os.environ.setdefault("GOOGLE_API_KEY", s.gemini_api_key)
    # LiteLLM reads provider keys straight from the environment.
    if s.groq_api_key:
        os.environ.setdefault("GROQ_API_KEY", s.groq_api_key)
    if s.openai_api_key:
        os.environ.setdefault("OPENAI_API_KEY", s.openai_api_key)
    if s.google_application_credentials:
        os.environ.setdefault(
            "GOOGLE_APPLICATION_CREDENTIALS", s.google_application_credentials
        )
    for env_name in (
        "LANGSMITH_TRACING",
        "LANGSMITH_ENDPOINT",
        "LANGSMITH_API_KEY",
        "LANGSMITH_PROJECT",
    ):
        value = getattr(s, env_name.lower())
        if value:
            os.environ.setdefault(env_name, value)


def _assert_safe_for_prod(s: Settings) -> None:
    """Fail fast if a dangerous dev shortcut is left enabled in production."""
    if s.app_env.lower() == "production" and s.auth_dev_bypass == "1":
        raise RuntimeError(
            "AUTH_DEV_BYPASS is enabled while APP_ENV=production — this would "
            "let any caller authenticate as any user. Refusing to start."
        )


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    _assert_safe_for_prod(s)
    _propagate_to_environ(s)
    return s


settings = get_settings()

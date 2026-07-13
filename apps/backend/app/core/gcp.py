import os
from functools import lru_cache

from google.cloud import firestore, storage

from app.core.config import get_settings


def _ensure_credentials_env() -> None:
    creds = get_settings().google_application_credentials
    if creds and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds


@lru_cache
def get_gcs_client() -> storage.Client:
    _ensure_credentials_env()
    project = get_settings().google_cloud_project or None
    return storage.Client(project=project)


@lru_cache
def get_firestore_client() -> firestore.AsyncClient:
    _ensure_credentials_env()
    project = get_settings().google_cloud_project or None
    return firestore.AsyncClient(project=project)

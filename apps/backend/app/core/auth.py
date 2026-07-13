"""Firebase ID token verification as a FastAPI dependency.

Frontend obtains an ID token from Firebase Auth, sends it on every request as
`Authorization: Bearer <token>`. `get_current_user` verifies the token via
firebase-admin and returns a `User` (uid, email). Endpoints that need an
authenticated caller add the dep:

    user: User = Depends(get_current_user)

For local dev without Firebase configured, set AUTH_DEV_BYPASS=1 in `.env`
and pass `Authorization: Bearer dev:<any-uid>` — the suffix becomes the uid.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache

import firebase_admin
from fastapi import Header, HTTPException, status
from firebase_admin import auth as fb_auth
from firebase_admin import credentials

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class User:
    uid: str
    email: str | None = None


@lru_cache
def _init_firebase_app() -> firebase_admin.App:
    settings = get_settings()
    cred_path = (
        settings.firebase_credentials_path
        or settings.google_application_credentials
    )
    if cred_path:
        cred = credentials.Certificate(cred_path)
    else:
        cred = credentials.ApplicationDefault()
    options = {}
    if settings.firebase_project_id:
        options["projectId"] = settings.firebase_project_id
    return firebase_admin.initialize_app(cred, options)


def _extract_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization must be 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return parts[1].strip()


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> User:
    token = _extract_bearer(authorization)

    settings = get_settings()
    if settings.auth_dev_bypass == "1" and token.startswith("dev:"):
        uid = token[4:].strip() or "dev-user"
        return User(uid=uid, email=f"{uid}@dev.local")

    try:
        _init_firebase_app()
        decoded = fb_auth.verify_id_token(token)
    except Exception as exc:
        logger.info("token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    uid = decoded.get("uid") or decoded.get("user_id")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing uid",
        )
    return User(uid=uid, email=decoded.get("email"))

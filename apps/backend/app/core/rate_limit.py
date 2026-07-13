"""In-memory sliding-window rate limiter, scoped per user.

Use it as a FastAPI dependency:

    rl = rate_limit("upload", limit=10, window_seconds=3600)

    @router.post("/upload-resume", dependencies=[Depends(rl)])
    async def upload_resume(user: User = Depends(get_current_user), ...):
        ...

The dep depends on `get_current_user` itself, so it has the uid in scope.
Single-process only — swap for Redis once we run more than one instance.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Depends, HTTPException, status

from app.core.auth import User, get_current_user

_buckets: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_lock = Lock()


def _check_and_record(key: tuple[str, str], limit: int, window: float) -> bool:
    now = time.monotonic()
    with _lock:
        dq = _buckets[key]
        cutoff = now - window
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= limit:
            return False
        dq.append(now)
        return True


def rate_limit(scope: str, limit: int, window_seconds: float):
    """Build a FastAPI dependency that enforces `limit` calls per `window_seconds` per user."""

    async def dep(user: User = Depends(get_current_user)) -> None:
        if not _check_and_record((scope, user.uid), limit, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {scope}",
            )

    return dep

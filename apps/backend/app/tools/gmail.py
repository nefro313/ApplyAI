"""Gmail compose URL builder."""
from __future__ import annotations

from urllib.parse import urlencode

GMAIL_COMPOSE_BASE = "https://mail.google.com/mail/"


def build_gmail_compose_url(to_email: str, subject: str, body: str) -> str:
    params = urlencode(
        {
            "view": "cm",
            "fs": "1",
            "to": to_email,
            "su": subject,
            "body": body,
        }
    )
    return f"{GMAIL_COMPOSE_BASE}?{params}"

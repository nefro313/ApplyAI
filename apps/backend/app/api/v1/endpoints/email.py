from fastapi import APIRouter, Depends, HTTPException, status

from app.agents.email_drafter import run_email_drafter
from app.core.auth import User, get_current_user
from app.core.gcp import get_firestore_client
from app.schemas.email import EmailDraft, EmailDraftRequest
from app.tools.gmail import build_gmail_compose_url

router = APIRouter(tags=["email"])

PIPELINES_COLLECTION = "pipelines"


@router.post("/draft-email", response_model=EmailDraft)
async def draft_email(
    payload: EmailDraftRequest,
    user: User = Depends(get_current_user),
) -> EmailDraft:
    snapshot = await (
        get_firestore_client()
        .collection(PIPELINES_COLLECTION)
        .document(payload.pipeline_id)
        .get()
    )
    if not snapshot.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline result not found",
        )

    data = snapshot.to_dict() or {}
    if data.get("user_id") != user.uid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline result not found",
        )

    candidate_name = data.get("candidate_name")
    role_title = data.get("role_title")
    company_name = data.get("company_name")
    fit_summary = data.get("fit_summary") or data.get("summary") or ""

    if not (candidate_name and role_title and company_name):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pipeline result missing candidate_name, role_title, or company_name",
        )

    draft = await run_email_drafter(
        candidate_name=candidate_name,
        role_title=role_title,
        company_name=company_name,
        fit_summary=fit_summary,
    )

    gmail_url = build_gmail_compose_url(
        to_email=payload.to_email,
        subject=draft["subject"],
        body=draft["body"],
    )

    return EmailDraft(
        subject=draft["subject"],
        body=draft["body"],
        to=payload.to_email,
        gmail_url=gmail_url,
    )

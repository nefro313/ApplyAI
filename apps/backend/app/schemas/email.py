from pydantic import BaseModel


class EmailDraftRequest(BaseModel):
    pipeline_id: str
    to_email: str


class EmailDraft(BaseModel):
    subject: str
    body: str
    to: str
    gmail_url: str

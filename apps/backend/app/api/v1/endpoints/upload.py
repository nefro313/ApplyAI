import logging
import uuid
from datetime import datetime, timezone
from functools import lru_cache

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from llama_cloud import AsyncLlamaCloud

from app.agents.resume_parser import run_resume_parser
from app.core.auth import User, get_current_user
from app.core.config import get_settings
from app.core.gcp import get_firestore_client, get_gcs_client
from app.core.rate_limit import rate_limit
from app.schemas.resume import FileType, ResumeUploadResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["upload"])

MAX_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_EXTENSIONS: set[FileType] = {"pdf", "docx", "txt"}
RESUMES_COLLECTION = "resumes"

upload_rate_limit = rate_limit("upload", limit=10, window_seconds=3600)


def _extension(filename: str) -> FileType:
    if "." not in filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File has no extension",
        )
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '.{ext}'. Allowed: .pdf, .docx, .txt",
        )
    return ext  # type: ignore[return-value]


@lru_cache
def _get_llama_client() -> AsyncLlamaCloud:
    api_key = get_settings().llamaindex_api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LLAMAINDEX_API_KEY is not configured",
        )
    return AsyncLlamaCloud(api_key=api_key)


async def _extract_text(content: bytes, file_type: FileType, filename: str) -> str:
    if file_type == "txt":
        return content.decode("utf-8", errors="replace").strip()

    client = _get_llama_client()
    file_obj = await client.files.create(
        file=(filename, content),
        purpose="parse",
    )
    result = await client.parsing.parse(
        file_id=file_obj.id,
        tier="cost_effective",
        version="latest",
        expand=["markdown_full", "text_full"],
    )
    return (result.markdown_full or result.text_full or "").strip()


async def _parse_and_store(file_id: str, raw_text: str) -> None:
    try:
        parsed = await run_resume_parser(raw_text)
        await get_firestore_client().collection(RESUMES_COLLECTION).document(
            file_id
        ).update({"parsed": parsed.model_dump(mode="json")})
    except Exception as exc:
        logger.warning("background resume parse failed for %s: %s", file_id, exc)


@router.post(
    "/upload-resume",
    response_model=ResumeUploadResponse,
    dependencies=[Depends(upload_rate_limit)],
)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> ResumeUploadResponse:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing filename",
        )

    file_type = _extension(file.filename)
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 5MB limit",
        )

    settings = get_settings()
    if not settings.gcs_bucket_name:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GCS_BUCKET_NAME is not configured",
        )

    file_id = str(uuid.uuid4())
    blob_path = f"resumes/{file_id}/{file.filename}"

    bucket = get_gcs_client().bucket(settings.gcs_bucket_name)
    blob = bucket.blob(blob_path)
    blob.upload_from_string(content, content_type=file.content_type or "application/octet-stream")
    gcs_url = f"gs://{settings.gcs_bucket_name}/{blob_path}"

    raw_text = await _extract_text(content, file_type, file.filename)
    uploaded_at = datetime.now(timezone.utc)

    await get_firestore_client().collection(RESUMES_COLLECTION).document(file_id).set(
        {
            "user_id": user.uid,
            "gcs_url": gcs_url,
            "raw_text": raw_text,
            "file_type": file_type,
            "uploaded_at": uploaded_at,
        }
    )

    if raw_text:
        background_tasks.add_task(_parse_and_store, file_id, raw_text)

    return ResumeUploadResponse(
        file_id=file_id,
        gcs_url=gcs_url,
        file_type=file_type,
        uploaded_at=uploaded_at,
        text_length=len(raw_text),
    )

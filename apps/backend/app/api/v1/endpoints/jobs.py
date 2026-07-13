from fastapi import APIRouter, Depends
from pydantic import BaseModel, HttpUrl

from app.core.auth import User, get_current_user
from app.tools.scraper import scrape_jd

router = APIRouter(tags=["jobs"])


class ScrapeJDRequest(BaseModel):
    url: HttpUrl


class ScrapeJDResponse(BaseModel):
    success: bool
    jd_text: str | None = None
    message: str | None = None


@router.post("/scrape-jd", response_model=ScrapeJDResponse)
async def scrape_jd_route(
    payload: ScrapeJDRequest,
    _user: User = Depends(get_current_user),
) -> ScrapeJDResponse:
    text = await scrape_jd(str(payload.url))
    if not text:
        return ScrapeJDResponse(
            success=False,
            jd_text=None,
            message="Unable to fetch JD. Please paste the JD manually.",
        )
    return ScrapeJDResponse(success=True, jd_text=text, message=None)

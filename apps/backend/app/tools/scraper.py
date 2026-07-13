"""Job description scraper.

Run 'playwright install chromium' after pip install.
"""
from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SITE_SELECTORS: dict[str, str] = {
    "greenhouse.io": "div.job__description",
    "lever.co": "div.section-wrapper",
    "myworkdayjobs.com": 'div[data-automation-id="jobPostingDescription"]',
    "linkedin.com": "div.description__text",
    "indeed.com": "div#jobDescriptionText",
}

JS_REQUIRED_MARKERS = (
    "enable javascript",
    "please enable js",
    "javascript is required",
)
MIN_CONTENT_LENGTH = 200
HTTP_TIMEOUT = 15.0
PLAYWRIGHT_TIMEOUT_MS = 20_000

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

EMOJI_PATTERN = re.compile(
    "["
    "\U0001f300-\U0001f6ff"
    "\U0001f900-\U0001f9ff"
    "\U0001fa00-\U0001faff"
    "\U00002600-\U000027bf"
    "\U0001f1e0-\U0001f1ff"
    "]+",
    flags=re.UNICODE,
)


def _match_selector(url: str) -> str | None:
    host = urlparse(url).netloc.lower()
    for domain, selector in SITE_SELECTORS.items():
        if domain in host:
            return selector
    return None


def _clean(text: str) -> str:
    text = EMOJI_PATTERN.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_from_html(html: str, selector: str | None) -> str:
    soup = BeautifulSoup(html, "lxml")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    if selector:
        node = soup.select_one(selector)
        if node:
            return _clean(node.get_text("\n"))

    blocks = soup.select("body p, body li")
    if blocks:
        return _clean("\n".join(b.get_text(" ", strip=True) for b in blocks))

    body = soup.body
    return _clean(body.get_text("\n") if body else "")


def _looks_javascript_gated(text: str) -> bool:
    if len(text) < MIN_CONTENT_LENGTH:
        return True
    lowered = text.lower()
    return any(marker in lowered for marker in JS_REQUIRED_MARKERS)


async def _fetch_with_httpx(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=HTTP_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text
    except Exception as exc:
        logger.warning("httpx fetch failed for %s: %s", url, exc)
        return None


async def _fetch_with_playwright(url: str, selector: str | None) -> str | None:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("playwright not installed; cannot use JS fallback")
        return None

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                context = await browser.new_context(user_agent=USER_AGENT)
                page = await context.new_page()
                await page.goto(
                    url,
                    wait_until="networkidle",
                    timeout=PLAYWRIGHT_TIMEOUT_MS,
                )
                if selector:
                    try:
                        await page.wait_for_selector(selector, timeout=5_000)
                    except Exception:
                        pass
                return await page.content()
            finally:
                await browser.close()
    except Exception as exc:
        logger.warning("playwright fetch failed for %s: %s", url, exc)
        return None


async def scrape_jd(url: str) -> str | None:
    try:
        selector = _match_selector(url)

        html = await _fetch_with_httpx(url)
        if html:
            text = _extract_from_html(html, selector)
            if not _looks_javascript_gated(text):
                return text

        html = await _fetch_with_playwright(url, selector)
        if not html:
            return None

        text = _extract_from_html(html, selector)
        return text or None
    except Exception as exc:
        logger.exception("scrape_jd failed for %s: %s", url, exc)
        return None

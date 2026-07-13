"""Aggregates v1 endpoint routers under a single APIRouter."""
from fastapi import APIRouter

from app.api.v1.endpoints import email, jobs, me, pipeline, upload

api_router = APIRouter()
api_router.include_router(upload.router)
api_router.include_router(jobs.router)
api_router.include_router(email.router)
api_router.include_router(pipeline.router)
api_router.include_router(me.router)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DEFAULT_WORKSPACE_SLUG
from app.api.routes import health
from app.api.v1 import (
    ai,
    comments,
    documents,
    exports,
    folders,
    permissions,
    templates,
    usage,
    workspaces,
)
from app.core.config import settings
from app.core.database import engine, init_db
from app.core.logging import configure_logging, get_logger
from app.core.middleware import RequestLoggingMiddleware
from app.models.workspace import Workspace
from app.repositories.workspaces import WorkspaceRepository


async def _seed_default_workspace() -> None:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        repo = WorkspaceRepository(session)
        existing = await repo.get_by_slug(DEFAULT_WORKSPACE_SLUG)
        if existing is not None:
            return
        await repo.create(
            Workspace(slug=DEFAULT_WORKSPACE_SLUG, name="Personal")
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    await init_db()
    await _seed_default_workspace()
    get_logger(__name__).info("app.startup", app=settings.app_name, env=settings.app_env)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(workspaces.router, prefix="/api/v1/workspaces", tags=["workspaces"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(folders.router, prefix="/api/v1/folders", tags=["folders"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["templates"])
# comments + permissions share /api/v1 because their paths nest under
# /documents/{doc_id}/... and stand-alone /comments/{id}, /sharing-links/{id}.
app.include_router(comments.router, prefix="/api/v1", tags=["comments"])
app.include_router(permissions.router, prefix="/api/v1", tags=["permissions"])
app.include_router(exports.router, prefix="/api/v1", tags=["exports"])
app.include_router(usage.router, prefix="/api/v1/usage", tags=["usage"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])

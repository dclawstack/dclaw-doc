import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.middleware.gzip import GZipMiddleware

from app.api.deps import DEFAULT_WORKSPACE_SLUG
from app.api.routes import health
from app.api.v1 import (
    ai,
    comments,
    compliance,
    documents,
    embeds,
    exports,
    folders,
    jobs,
    merge,
    notarization,
    ocr,
    permissions,
    preferences,
    sign_requests,
    templates,
    translation,
    usage,
    workspaces,
    ws_collab,
)
# DEMO-ONLY (remove this import + the matching include_router below
# before production; see app/api/v1/demo.py for the full removal list)
from app.api.v1 import demo
# Importing the jobs runner registers the default handlers via decorators.
from app.services import jobs as _jobs_module  # noqa: F401
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
    from app.services.jobs import shutdown as jobs_shutdown
    from app.services.jobs import start_worker as start_jobs_worker

    configure_logging()
    await init_db()
    await _seed_default_workspace()
    await start_jobs_worker()
    get_logger(__name__).info("app.startup", app=settings.app_name, env=settings.app_env)
    try:
        yield
    finally:
        await jobs_shutdown()


# Observability: initialize Sentry only when a DSN is configured.
if os.environ.get("SENTRY_DSN"):
    import sentry_sdk

    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        environment=settings.app_env,
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
    )

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting (slowapi).
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Response compression.
app.add_middleware(GZipMiddleware, minimum_size=500)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Bind a request_id into the structlog context and echo it on the response."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    log = get_logger("http").bind(request_id=request_id)
    log.debug("request.received", path=request.url.path, method=request.method)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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
app.include_router(compliance.router, prefix="/api/v1", tags=["compliance"])
app.include_router(notarization.router, prefix="/api/v1", tags=["notarization"])
app.include_router(translation.router, prefix="/api/v1", tags=["translation"])
app.include_router(embeds.router, prefix="/api/v1/embeds", tags=["embeds"])
app.include_router(preferences.router, prefix="/api/v1/feedback", tags=["feedback"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(sign_requests.router, prefix="/api/v1", tags=["sign_requests"])
app.include_router(ocr.router, prefix="/api/v1/ocr", tags=["ocr"])
app.include_router(merge.router, prefix="/api/v1", tags=["merge"])
app.include_router(ws_collab.router, prefix="/api/v1", tags=["collab"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
# DEMO-ONLY (remove this line + the demo import above before production)
app.include_router(demo.router, prefix="/api/v1/demo", tags=["demo"])

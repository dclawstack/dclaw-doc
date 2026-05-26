import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Emit one structured log line per request, with request_id + workspace_id context."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        workspace_id = request.headers.get("X-Workspace-Id")
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            workspace_id=workspace_id,
            path=request.url.path,
            method=request.method,
        )
        logger = structlog.get_logger("http")
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.info("request", status=status, duration_ms=duration_ms)

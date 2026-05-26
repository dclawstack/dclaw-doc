import logging
import sys

import structlog

from app.core.config import settings


def configure_logging() -> None:
    """Configure structlog for the application.

    JSON in non-dev environments; human-readable in dev.
    Idempotent — safe to call from lifespan + tests.
    """
    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        timestamper,
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.app_env == "dev":
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer(colors=False)
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)

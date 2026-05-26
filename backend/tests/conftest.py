import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.api.deps import DEFAULT_WORKSPACE_SLUG
from app.api.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.workspace import Workspace
from app.repositories.workspaces import WorkspaceRepository

TEST_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/dclaw_doc_test",
)

# SQLite in-memory needs a StaticPool so all sessions share one connection;
# otherwise each new connection sees an empty database.
_is_sqlite_memory = TEST_DATABASE_URL.startswith("sqlite") and ":memory:" in TEST_DATABASE_URL
_engine_kwargs = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}} if _is_sqlite_memory else {"poolclass": NullPool}
test_engine = create_async_engine(TEST_DATABASE_URL, **_engine_kwargs)


async def override_get_db():
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        repo = WorkspaceRepository(session)
        await repo.create(Workspace(slug=DEFAULT_WORKSPACE_SLUG, name="Personal"))
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def default_workspace_id():
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        repo = WorkspaceRepository(session)
        workspace = await repo.get_by_slug(DEFAULT_WORKSPACE_SLUG)
        assert workspace is not None
        return str(workspace.id)

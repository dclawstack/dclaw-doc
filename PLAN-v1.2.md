# DClaw Doc — v1.2 Feature Roadmap

> 📘 **REVISED PRD v2.3 available:** See `REVISED-PRD.md` for product identity, current state, sacred tech stack, and source feature buckets (P0/P1/P2).
>
> This plan supersedes the older P0/P1/P2 ordering with a **complexity-based** roadmap (0/1/2). The PRD buckets still describe the *what*; this file describes the *order and how*.

---

## 0. Positioning & YC Wedge

**Generic framing ("smart documents") will not clear the YC bar.** The product must read as a defensible *AI document workspace for regulated content* — legal, clinical, finance — where every word is auditable, every AI answer is cited, and every collaborator action is provenance-tracked. Horizontal feature parity with Notion/Coda is a side-effect, not the pitch.

**YC-grade differentiators baked into this roadmap:**

| Theme | Why it matters | Where it appears below |
|-------|----------------|------------------------|
| **Verifiable AI** — every AI output cites a paragraph-level source | Removes hallucination risk for regulated buyers | Complexity 1 (RAG + citations) |
| **Agentic copilot** — tools to *act*, not just chat | Beats chat-wrapper competitors | Complexity 2 (tool-calling) |
| **CRDT real-time edit** — Yjs, offline-first | Differentiator vs. Google Docs OT lock-in | Complexity 2 |
| **Per-tenant cost telemetry + eval harness** | Answers "how do you know it's good?" + "what at scale?" | Complexity 1 |
| **Compliance metadata layer** (redaction, audit, signatures) | Wedge into legal/clinical/finance | Complexity 2 |
| **Multi-tenant from day one** | Removes the "rewrite later" arch debt that kills startups | Complexity 0 |

---

## 1. Pre-Flight Checklist

- [ ] `frontend/package-lock.json` committed after any `npm install` / dependency change
- [ ] `frontend/next-env.d.ts` exists and is committed
- [ ] `docker-compose.yml` healthchecks correct (Postgres 5432, backend 8107, frontend 3020)
- [ ] `frontend/Dockerfile` declares `ARG NEXT_PUBLIC_API_URL` before `RUN npm run build`
- [ ] Local dev DB initializes via `aiosqlite` when `DATABASE_URL` is unset
- [ ] `alembic upgrade head` succeeds against both SQLite (local) and Postgres (CI/prod)

## 2. Current State (audited against PRD §2)

- ✅ Backend skeleton: FastAPI app, `Base(DeclarativeBase)`, base repo, health route
- ❌ `app/api/v1/doc.py` exists but is **not wired** in `app/api/main.py`
- ❌ `app/api/v1/doc.py` returns **mocked data** (violates AGENTS `NO MOCK DATA`)
- ❌ No `Document` model / repository / schemas
- ❌ Empty `alembic/versions/` — no migrations exist
- ❌ Frontend `page.tsx` is a placeholder
- ❌ `frontend/public/dclaw-manifest.json` missing (PRD gap #1)
- ❌ No AI endpoints, no RAG, no eval harness, no multi-tenant scoping

## 3. Roadmap by Complexity

Each feature card includes: scope, files touched, acceptance criteria. Items inside a tier are roughly ordered by build sequence.

---

### 🟢 Complexity 0 — Foundation (quick wins, unblock everything)

> Goal: kill all mocks, get a real CRUD loop end-to-end with multi-tenant scoping, run locally on SQLite in <30s.

#### 0.1 — Local SQLite dev path (env-overridable)
- Default `DATABASE_URL` for local dev → `sqlite+aiosqlite:///./dclaw_doc.db`
- Postgres remains the prod/CI default via env override
- Add `aiosqlite` to `requirements.txt`
- Update `alembic/env.py` to render `batch_alter_table` for SQLite compatibility
- **Files:** `backend/app/core/config.py`, `backend/requirements.txt`, `backend/alembic/env.py`, `.env.example`
- **Accept:** `uvicorn app.api.main:app` boots with no Postgres running; `alembic upgrade head` succeeds against SQLite.

#### 0.2 — Real `Document` + `Workspace` models
- `Workspace` (id, slug, name, created_at) — multi-tenant root
- `Document` (id, workspace_id, title, content_md, content_json, created_at, updated_at, deleted_at) — soft-delete
- `Folder` (id, workspace_id, parent_id, name) — hierarchical
- `Tag` + `DocumentTag` association
- All FKs `ondelete="CASCADE"` to workspace
- All relationships `lazy="selectin"`
- **Files:** `backend/app/models/{workspace,document,folder,tag}.py`
- **Accept:** Models import cleanly; pass `alembic revision --autogenerate`.

#### 0.3 — Initial alembic migration
- Generate from new models; works on SQLite + Postgres
- Commit migration file
- **Files:** `backend/alembic/versions/0001_initial.py`
- **Accept:** `alembic upgrade head && alembic downgrade base` is a no-op on both engines.

#### 0.4 — Replace mock `doc.py` with real CRUD
- `POST /api/v1/documents` (create)
- `GET /api/v1/documents` (list, scoped to workspace, paginated)
- `GET /api/v1/documents/{id}` (read)
- `PATCH /api/v1/documents/{id}` (update)
- `DELETE /api/v1/documents/{id}` (soft-delete)
- All routes require an `X-Workspace-Id` header (placeholder for Logto JWT claim in tier 1)
- Pydantic v2 schemas with `ConfigDict(from_attributes=True)`
- `DocumentRepository(BaseRepository[Document])`
- **Files:** `backend/app/api/v1/documents.py`, `backend/app/schemas/documents.py`, `backend/app/repositories/documents.py`
- **Accept:** No mocked data anywhere; all reads/writes round-trip the DB.

#### 0.5 — Wire v1 router in `api/main.py`
- Include `documents`, `workspaces`, `folders` routers under `/api/v1`
- **Files:** `backend/app/api/main.py`, `backend/app/api/v1/__init__.py`
- **Accept:** `GET /openapi.json` shows v1 routes.

#### 0.6 — Workspaces + folders CRUD (slim)
- `POST /api/v1/workspaces` (create); seed a default `"personal"` workspace on app boot
- `GET /api/v1/folders?workspace_id=...` (tree)
- **Files:** `backend/app/api/v1/{workspaces,folders}.py`, repos, schemas
- **Accept:** Default workspace exists after first boot; folders create/list works.

#### 0.7 — Backend tests (CRUD coverage)
- pytest + pytest-asyncio (pinned 0.24.0)
- `httpx.AsyncClient + ASGITransport`
- Test DB override → `localhost:5432/dclaw_doc_test` in CI, in-memory SQLite locally
- One test per CRUD endpoint per resource
- **Files:** `backend/tests/test_documents.py`, `test_workspaces.py`, `test_folders.py`
- **Accept:** `pytest -q` passes locally + in CI.

#### 0.8 — Frontend dashboard (real, not stub)
- Replace `frontend/src/app/page.tsx` with a dashboard
- Doc list + "New Doc" + click-through to `/docs/[id]`
- Use pre-built UI components (`Card`, `Button`, `Input`, `Table`) — DO NOT install shadcn CLI
- API client functions in `src/lib/api.ts`
- **Files:** `frontend/src/app/page.tsx`, `frontend/src/app/docs/[id]/page.tsx`, `frontend/src/lib/api.ts`
- **Accept:** Create a doc in the UI; refresh; doc is still there (proves real persistence).

#### 0.9 — `dclaw-manifest.json` (DPanel registration)
- Manifest in `frontend/public/dclaw-manifest.json` with app id, name, color, backend/frontend ports
- **Files:** `frontend/public/dclaw-manifest.json`
- **Accept:** Manifest validates against PRD §4 / DClaw Master schema.

#### 0.10 — Structured logging
- `structlog` configured at app startup; JSON output in prod, pretty in dev
- Replace any `print()` (none expected, enforce going forward)
- **Files:** `backend/app/core/logging.py`, wired in `api/main.py` lifespan
- **Accept:** Every request emits one structured log line with `request_id`, `workspace_id`, `path`, `status`, `duration_ms`.

#### 0.11 — Title search (LIKE-based, pre-vector)
- `GET /api/v1/documents?q=...` filters by title `ILIKE` (Postgres) / `LIKE` (SQLite)
- **Files:** `backend/app/repositories/documents.py`
- **Accept:** Search returns matching titles in <50ms on 1k docs.

---

### 🟡 Complexity 1 — Core differentiators

> Goal: a credible YC demo. Streaming AI copilot with citations, RAG over the workspace, eval-tracked. Auth, permissions, version history. Multi-tenant hardened.

#### 1.1 — Logto JWT validation middleware
- Verify Bearer token; extract `sub` (user) + `workspace_id` claim; replace `X-Workspace-Id` header
- Protected routes use `Depends(current_user)` dependency
- **Files:** `backend/app/core/auth.py`, `backend/app/api/deps.py`

#### 1.2 — Streaming AI Doc Copilot endpoint
- `POST /api/v1/ai/doc-chat` → `StreamingResponse` (SSE)
- Provider abstraction: OpenRouter primary, Ollama fallback (env-driven)
- Request includes `document_id`, `selection_range?`, `prompt`, `mode` (rewrite / summarize / translate / explain)
- **Files:** `backend/app/services/llm.py` (provider), `backend/app/services/doc_ai.py`, `backend/app/api/v1/ai.py`
- **Accept:** Stream first token in <500ms; finishes within model SLA.

#### 1.3 — Rich text block editor (TipTap)
- Block-based editor in `frontend`; stores ProseMirror JSON in `Document.content_json` + a Markdown projection in `content_md`
- Autosave debounced 1s
- AI toolbar: highlight → "Rewrite / Summarize / Translate" → streams into the doc
- **Files:** `frontend/src/components/editor/*`, `frontend/src/app/docs/[id]/page.tsx`
- **Accept:** Reload restores exact block state; selection-scoped AI works.

#### 1.4 — Version history + diff
- `DocumentVersion` table: snapshot per save (compact diff vs prior)
- `GET /api/v1/documents/{id}/versions` and `/versions/{n}` (restore)
- Frontend timeline + side-by-side diff
- **Files:** `backend/app/models/document_version.py`, `backend/app/services/versioning.py`, `frontend/src/app/docs/[id]/history/page.tsx`

#### 1.5 — RAG: embeddings + semantic search (pgvector / sqlite-vss)
- On save: chunk content (paragraph-level), embed via local model (Ollama `nomic-embed-text` fallback) or OpenRouter
- Store in `DocumentChunk(id, document_id, workspace_id, ordinal, text, embedding)`
- `pgvector` on Postgres; `sqlite-vss` on local SQLite
- `POST /api/v1/ai/search` → hybrid (BM25 + cosine)
- **Files:** `backend/app/services/embeddings.py`, `backend/app/services/search.py`, `backend/app/models/document_chunk.py`
- **Accept:** Search 10k docs <1s p95; results include `document_id`, `chunk_ordinal`, `score`.

#### 1.6 — Verifiable AI: citation provenance
- Every AI streamed answer is paired with `[citations]: [{doc_id, chunk_ordinal, score}]` events on the SSE stream
- Frontend renders chunks as clickable footnotes that scroll to the source paragraph
- **Files:** `backend/app/services/doc_ai.py` (citation post-processor), `frontend/src/components/editor/citations.tsx`
- **Accept:** No AI output appears in the UI without ≥1 citation when sources exist.

#### 1.7 — Comments + threaded review
- `Comment(id, document_id, parent_id?, anchor_block_id, body, author_id, resolved_at?)`
- `POST/GET/PATCH/DELETE /api/v1/documents/{id}/comments`
- Frontend: inline anchored comments with thread; resolve toggle
- **Files:** `backend/app/models/comment.py`, `backend/app/api/v1/comments.py`, `frontend/src/components/comments/*`

#### 1.8 — Granular permissions (ACL)
- `DocumentPermission(document_id, principal_id, principal_type, role)` where role ∈ {viewer, commenter, editor, owner}
- Sharing links with expiration + password
- Middleware enforces on every doc route
- **Files:** `backend/app/models/permission.py`, `backend/app/services/acl.py`

#### 1.9 — Templates + simple workflows
- `Template(id, workspace_id, name, content_json, variables_schema)`
- "Create from template" pre-fills variables; renders to doc
- Simple linear workflow: draft → review → approved (status enum on Document)
- **Files:** `backend/app/models/template.py`, `backend/app/api/v1/templates.py`, `frontend/src/app/templates/page.tsx`

#### 1.10 — AI Eval harness
- Golden dataset (`tests/evals/doc_copilot/*.yaml`): input prompt + expected behaviors (must-include / must-not-include)
- Runner script `scripts/eval.py` → outputs pass/fail + score per release
- Each eval result tagged with model id + prompt-hash + git sha
- **Files:** `backend/scripts/eval.py`, `backend/tests/evals/`
- **Accept:** `make eval` produces a JSON report; CI gates merges on regression >5%.

#### 1.11 — OpenTelemetry tracing + per-tenant cost telemetry
- OTLP exporter (Jaeger compatible)
- Every AI call logs: model, prompt_tokens, completion_tokens, latency_ms, workspace_id
- Daily aggregation table `WorkspaceUsage(workspace_id, date, ai_tokens_in, ai_tokens_out, cost_cents)`
- **Files:** `backend/app/core/telemetry.py`, `backend/app/models/usage.py`

#### 1.12 — Export / Import (Markdown + HTML)
- `POST /api/v1/documents/{id}/export?format=md|html|json`
- `POST /api/v1/imports` — accept .md/.html → create document
- Preserve heading hierarchy + lists; round-trip tested
- **Files:** `backend/app/services/exporters.py`, `backend/app/api/v1/exports.py`

#### 1.13 — Feature flags (env-driven, simple)
- `Settings.features: dict[str, bool]`; AI features gated by flag for rollouts
- **Files:** `backend/app/core/config.py`, decorator `@feature_gated("ai_copilot")`

---

### 🔴 Complexity 2 — Advanced (YC demo stunner + post-funding)

> Goal: the things that make reviewers say "I haven't seen this before."

#### 2.1 — CRDT real-time collaboration (Yjs over WebSocket)
- `ws://.../api/v1/documents/{id}/sync` — y-websocket compatible
- Server persists Yjs updates incrementally to `DocumentUpdate(document_id, payload, seq, author_id)`
- Awareness: live cursors + presence
- **Files:** `backend/app/services/collab.py`, `backend/app/api/v1/ws_collab.py`, `frontend/src/lib/yjs.ts`

#### 2.2 — Tool-calling agentic copilot
- Copilot can invoke registered tools: `send_for_signature`, `query_workspace_docs` (RAG), `create_doc_from_template`, `summarize_thread`, `redact_pii`
- Loop bounded (max 5 tool calls per turn); all calls logged
- **Files:** `backend/app/services/agent.py`, `backend/app/services/tools/*.py`

#### 2.3 — Document chat (full-workspace RAG)
- `POST /api/v1/ai/chat` — natural-language Q over the entire workspace
- Reuses 1.5 RAG pipeline; answers include doc-level + chunk-level citations
- Frontend: floating chat panel on every page (PRD §9 mandate)
- **Files:** `frontend/src/components/copilot/panel.tsx`, `backend/app/api/v1/ai.py`

#### 2.4 — Compliance metadata layer
- Per-document sensitivity tags (PII / PHI / confidential / public)
- PII detection on save (`presidio` or LLM-based) → auto-redaction option
- Audit log table: who saw what, when, from where; immutable append-only
- **Files:** `backend/app/services/compliance/*`, `backend/app/models/audit_event.py`

#### 2.5 — Offline mode + 3-way merge
- Frontend IndexedDB cache of Yjs doc; queue updates while offline
- Server reconciliation on reconnect; 3-way merge for non-CRDT fields (title, tags)
- **Files:** `frontend/src/lib/offline.ts`, `backend/app/services/sync.py`

#### 2.6 — E-signature integration (DocuSign or OpenSign)
- `POST /api/v1/documents/{id}/sign-requests`; webhook handler updates status
- Audit trail entries on each signature event
- **Files:** `backend/app/services/esign/*`, `backend/app/api/v1/sign_requests.py`

#### 2.7 — AI translation with layout preservation
- Per-block translation preserving ProseMirror structure (so headings remain headings)
- Glossary support (workspace-level term map)
- **Files:** `backend/app/services/translation.py`

#### 2.8 — OCR + handwriting (vision LLM)
- Upload scanned PDF/image → vision model extracts blocks → creates a doc
- **Files:** `backend/app/services/ocr.py`, `backend/app/api/v1/imports.py`

#### 2.9 — Cryptographic notarization
- On approval, hash the doc + sign with workspace key; store signature + timestamp
- Verifiable via `GET /api/v1/documents/{id}/notarization`
- **Files:** `backend/app/services/notarization.py`

#### 2.10 — Live data embeds
- Embed a SQL query, a sheet range, or an API result that auto-refreshes
- **Files:** `backend/app/services/embeds/*`, frontend block extension

#### 2.11 — Preference-data flywheel
- Capture every edit-after-AI-suggestion as a `(suggestion, accepted_text)` pair → preference dataset
- Periodic export for ranking-model fine-tune
- **Files:** `backend/app/models/ai_feedback.py`, `backend/scripts/export_preferences.py`

#### 2.12 — Background jobs (Arq / Temporal-lite)
- Long AI tasks (translate 50-page doc, full-workspace re-embed) run via Arq workers
- Status polled via `GET /api/v1/jobs/{id}`
- **Files:** `backend/app/jobs/*`, `backend/worker.py`

---

## 4. Build Order

1. **Complexity 0 (this PR + next few):** 0.1 → 0.10 in order, finishing with 0.8 (frontend dashboard) and 0.11 (search).
2. **Complexity 1:** Order matters — 1.1 (auth) and 1.2 (streaming AI) first to unlock everything; 1.5 (RAG) before 1.6 (citations); 1.10 (evals) wired into CI early.
3. **Complexity 2:** Pick by demo value: 2.1 (CRDT collab) + 2.2 (agentic) + 2.3 (workspace chat) are the YC demo trio.

## 5. Definition of Done (every tier)

- Code compiles and `pytest -q` passes locally + CI
- New endpoints documented in OpenAPI
- Migration committed (no schema-drift)
- Frontend pages use only pre-built UI components (no shadcn CLI)
- Anti-patterns from AGENTS.md respected (no `MOCK_*`, no `default_factory` in `mapped_column`, no tz-aware datetimes in models, `localhost:5432` test DB)
- One structured log line per request
- Feature flag for any AI feature

---

*Plan version: 2.0 (complexity-tier rewrite)*
*Last updated: 2026-05-26*

# DClaw Doc — v1.2 Feature Roadmap

> Based on: Y Combinator vertical SaaS principles, trending GitHub repos (onlyoffice, collabora), AI product research (Notion, Coda, Google Docs AI, Microsoft Copilot)

## Pre-Flight Checklist

- [ ] `frontend/package-lock.json` committed after any `npm install` / dependency change
- [ ] `frontend/next-env.d.ts` exists and is committed
- [ ] `docker-compose.yml` healthchecks correct
- [ ] `frontend/Dockerfile` declares `ARG NEXT_PUBLIC_API_URL` before `RUN npm run build`

## v1.0 Feature Inventory (Current)

- [ ] Document CRUD
- [ ] Rich text editor
- [ ] Folder organization
- [ ] Basic sharing
- [ ] Real backend CRUD (no mocks)
- [ ] Docker + Helm deployment
- [ ] Alembic migrations
- [ ] Backend tests

---

## v1.2 Roadmap

### P0 — Must Have (Ship in v1.0, demo-ready)

#### 1. AI Doc Copilot (Writing Assistant)
**Description:** AI assistant that helps write, edit, summarize, and translate documents inline. "Summarize this section in 3 bullets."
- **AI Angle:** Inline LLM suggestions. Summarization. Translation. Tone adjustment.
- **Backend:** `/api/v1/ai/doc-chat` endpoint. Streaming completions.
- **Frontend:** Editor with AI toolbar. Slash commands and highlight-to-edit.
- **Files:** `backend/app/services/doc_ai.py`, `frontend/src/components/doc-copilot.tsx`

#### 2. Real-Time Collaborative Editor
**Description:** Multi-user editing with live cursors, comments, and suggestions (Google Docs-style).
- **Backend:** Operational Transform / Yjs sync server.
- **Frontend:** Collaborative editor with user presence and comment threads.
- **Files:** `backend/app/services/collaboration.py`

#### 3. Smart Templates & Forms
**Description:** Pre-built templates with smart fields. Convert docs to fillable forms.
- **Backend:** Template engine with variable substitution.
- **Frontend:** Template gallery. Form builder mode.
- **Files:** `backend/app/services/templates.py`

#### 4. Version History & Compare
**Description:** Full version history with diff view. Restore any previous version.
- **Backend:** Version storage with diff algorithm.
- **Frontend:** Timeline view with side-by-side diff.
- **Files:** `backend/app/services/versions.py`

### P1 — Should Have (v1.1–1.2)

#### 5. AI Document Analysis
**Description:** Upload any document. AI extracts key points, action items, and entities.
- **AI Angle:** Document parsing + structured extraction.
- **Backend:** `/api/v1/ai/analyze-doc` endpoint.
- **Frontend:** Upload → analysis report with extracted highlights.

#### 6. E-Signature Integration
**Description:** Send documents for signature. Track status. Audit trail.
- **Backend:** DocuSign/HelloSign integration.
- **Frontend:** Signature request workflow. Status tracker.

#### 7. Advanced Permissions & Access
**Description:** Granular permissions: view, comment, edit. Expiring links. Password protection.
- **Backend:** Permission engine with inheritance.
- **Frontend:** Share dialog with advanced options.

#### 8. Document Automation (Mail Merge)
**Description:** Generate personalized documents from data sources (CRM, spreadsheets).
- **Backend:** Mail merge engine with data binding.
- **Frontend:** Merge wizard with preview.

### P2 — Could Have (v1.3+)

#### 9. AI-Powered Knowledge Base Auto-Build
**Description:** Auto-organize documents into a structured knowledge base with taxonomy.

#### 10. OCR & Handwriting Recognition
**Description:** Extract text from scanned documents and handwritten notes.

#### 11. Document Chat (RAG)
**Description:** Chat with your documents. Ask questions across your entire document library.

#### 12. Blockchain Document Notarization
**Description:** Immutable proof of document existence and integrity.

---

## Implementation Priority

1. **Week 1–2:** AI Doc Copilot (P0.1) + Collaborative Editor (P0.2)
2. **Week 3–4:** Smart Templates (P0.3) + Version History (P0.4)
3. **Week 5–6:** Document Analysis (P1.5) + E-Signature (P1.6)
4. **Week 7–8:** Permissions (P1.7) + Document Automation (P1.8)

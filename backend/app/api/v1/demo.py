"""Demo / showcase routes.

⚠️ DEMO-ONLY — REMOVE BEFORE PRODUCTION
=========================================
Everything in this file exists so the public landing page can seed the
workspace with realistic content and reset it back to a clean state.
None of it is required by the product.

To remove:
  1. Delete this file (``app/api/v1/demo.py``).
  2. Drop the ``demo`` import + ``include_router(demo.router, ...)``
     line from ``app/api/main.py`` (look for the DEMO-ONLY marker).
  3. Drop the ``demo_endpoints`` entry from ``DEFAULT_FEATURES`` in
     ``app/core/config.py`` and the ``DemoControls`` component +
     ``/api/v1/demo/*`` references from the frontend.

The endpoints are gated on the ``demo_endpoints`` feature flag so they
can also be disabled at runtime via:
    FEATURES='{"demo_endpoints":false}'
"""
from __future__ import annotations

import json
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DEFAULT_WORKSPACE_SLUG
from app.core.config import is_enabled, settings
from app.core.database import get_db
from app.core.utils import utc_now
from app.models.audit_event import AuditEvent
from app.models.comment import Comment
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.document_version import DocumentVersion
from app.models.embed import LiveEmbed
from app.models.folder import Folder
from app.models.job import Job
from app.models.notarization import Notarization
from app.models.permission import DocumentPermission, SharingLink
from app.models.preference import AIFeedback
from app.models.sign_request import SignRequest
from app.models.tag import DocumentTag, Tag
from app.models.template import Template
from app.models.usage import WorkspaceUsage
from app.models.workspace import Workspace
from app.models.yjs_update import YjsUpdate
from app.repositories.document_versions import DocumentVersionRepository
from app.repositories.workspaces import WorkspaceRepository
from app.services.notarization import content_hash, sign
from app.services.rag import reindex_document
from app.services.versioning import snapshot

router = APIRouter()


def _require_enabled() -> None:
    # Fail-closed: these endpoints are DESTRUCTIVE (they wipe all workspace
    # data) and must be explicitly enabled via DEMO_ENABLED=true. They must
    # NEVER be reachable in production. We 404 (not 403) so disabled demo
    # routes are indistinguishable from non-existent ones.
    if not settings.demo_enabled or not is_enabled("demo_endpoints"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="demo endpoints disabled",
        )


# -----------------------------------------------------------------------------
# Reset
# -----------------------------------------------------------------------------

# Tables whose rows we wipe on reset, in FK-safe order. We don't reset the
# personal workspace itself — we just empty its contents and drop every
# other workspace (which cascades to their data).
_WIPE_TABLES = [
    YjsUpdate,
    AIFeedback,
    Job,
    SignRequest,
    Notarization,
    LiveEmbed,
    AuditEvent,
    SharingLink,
    DocumentPermission,
    Comment,
    DocumentChunk,
    DocumentVersion,
    DocumentTag,
    Tag,
    Template,
    WorkspaceUsage,
    Document,
    Folder,
]


@router.post("/reset", status_code=status.HTTP_200_OK)
async def reset_demo_data(db: AsyncSession = Depends(get_db)) -> dict:
    """Wipe all docs, comments, versions, etc. Keep the personal workspace.

    Returns row counts removed per table — useful for the UI confirmation
    toast.
    """
    _require_enabled()
    removed: dict[str, int] = {}
    for model in _WIPE_TABLES:
        count_stmt = select(model)
        rows = (await db.execute(count_stmt)).scalars().all()
        if rows:
            removed[model.__tablename__] = len(rows)
        await db.execute(delete(model))

    # Drop every workspace that isn't the seeded default. (Personal can't
    # be removed — if we did, current_workspace_id would 503 on the next
    # request.)
    ws_stmt = select(Workspace).where(Workspace.slug != DEFAULT_WORKSPACE_SLUG)
    extra_workspaces = (await db.execute(ws_stmt)).scalars().all()
    for ws in extra_workspaces:
        await db.delete(ws)
    if extra_workspaces:
        removed["workspaces"] = len(extra_workspaces)

    await db.commit()
    return {"removed": removed}


# -----------------------------------------------------------------------------
# Seed
# -----------------------------------------------------------------------------

# Match the dev-mode user_id returned by ``app.core.auth.current_user`` when
# the request has no Authorization header. Keeping these aligned means
# every seeded doc is owned by whoever views the dashboard (the dev user
# in local dev), so ACL gates don't hide demo content.
_DEMO_USER = "dev-user"


_LEGAL_MSA = """\
# Master Services Agreement

This Master Services Agreement ("Agreement") is entered into as of
2026-05-01 by and between **Acme Corp.** ("Client") and **DClaw Stack Inc.**
("Provider").

## 1. Scope

Provider will deliver document-workspace software per the Statement of
Work attached as Exhibit A.

## 2. Term

This Agreement remains in effect for twelve (12) months from the
Effective Date and renews annually unless either party gives sixty (60)
days written notice.

## 3. Confidentiality

Each party will treat the other's Confidential Information as it does
its own, exercising no less than a reasonable standard of care.
Confidential Information includes pricing, source code, and any
information marked "Confidential". Contact legal@acme.example for
specifics.

## 4. Indemnification

Each party will indemnify the other against third-party claims arising
from gross negligence or willful misconduct.

## 5. Limitation of Liability

In no event will either party's aggregate liability exceed the fees
paid under this Agreement in the twelve months preceding the claim.

## 6. Governing Law

This Agreement is governed by the laws of the State of Delaware.
"""

_LEGAL_NDA = """\
# Mutual Non-Disclosure Agreement

This Mutual Non-Disclosure Agreement is entered into between
**Acme Corp.** and **DClaw Stack Inc.** effective 2026-05-15.

## 1. Definition

"Confidential Information" means any non-public information disclosed
by one party to the other in connection with potential or actual
business relationships.

## 2. Obligations

Each party agrees to:
- Use the other's Confidential Information solely to evaluate the
  potential business relationship;
- Disclose the Confidential Information only to employees with a need
  to know who are bound by confidentiality obligations;
- Protect the Confidential Information with the same standard of care
  used for its own confidential materials.

## 3. Exclusions

Confidential Information does not include information that:
- Was publicly available prior to disclosure;
- Was independently developed without reference to the Confidential
  Information;
- Was rightfully received from a third party without restriction.

## 4. Term

Confidentiality obligations survive for five (5) years from the
Effective Date.
"""

_LEGAL_PRIVACY = """\
# Privacy Policy

DClaw Doc respects your privacy. This document describes how we
collect, use, and protect personal data.

## What we collect

- Account information you provide (name, email).
- Document content you store in the workspace.
- Usage metrics (request counts, AI token totals).

## How we use it

We use your data to operate and improve the service. We do not sell
personal data. AI providers may process document text only when you
explicitly invoke a copilot action.

## Your rights

You can export or delete your workspace at any time from the dashboard.

For questions, contact privacy@dclawstack.io.
"""

_CLINICAL_TRIAL = """\
# Phase 2 Trial Protocol — DCL-2026-002

## Overview

Randomized, double-blind, placebo-controlled trial evaluating the
efficacy of DCL-X231 in adults with moderate-to-severe condition Y.

## Patient eligibility

Inclusion criteria:
- Age 18–65
- Confirmed diagnosis of condition Y per ICD-10 K50.x
- No participation in another investigational trial within 90 days

Exclusion criteria:
- Pregnancy or breastfeeding
- Severe renal impairment (eGFR < 30)
- Known hypersensitivity to study drug class

## Visit schedule

- Screening (Day -28 to Day -1)
- Randomization (Day 0)
- Follow-up visits at Weeks 2, 4, 8, 12, 24

## Endpoints

Primary: Change from baseline in symptom severity score at Week 12.
Secondary: Patient-reported quality of life, biomarker response.

## Investigator contact

Principal Investigator: Dr. M. Reyes, mreyes@clinic.example,
+1 (415) 555-0142.
"""

_CLINICAL_ONBOARDING = """\
# Patient Onboarding Checklist

## Pre-visit

- [ ] Insurance verification complete
- [ ] Demographics intake form returned
- [ ] Consent for telehealth signed
- [ ] Medication reconciliation (last 90 days)

## Day-of

- [ ] Vitals captured
- [ ] Provider review of intake form
- [ ] Care plan drafted
- [ ] Follow-up scheduled

## Post-visit

- [ ] Visit note signed within 24 hours
- [ ] Lab orders submitted
- [ ] Patient summary mailed
"""

_CLINICAL_IRB = """\
# IRB Submission Checklist

Use this checklist for every new protocol submission to the
Institutional Review Board.

## Required materials

- Protocol document (current version)
- Investigator's Brochure
- Informed Consent Form (English + Spanish translations)
- Recruitment materials
- Data Safety Monitoring Plan

## Common rejections

- Inconsistent visit schedules across protocol and consent form
- Missing site-specific risk assessment
- Outdated investigator CV (older than 24 months)
"""

_WELCOME = """\
# Welcome to DClaw Doc

This is your **Personal** workspace. Things you can try right now:

- **AI copilot** — open the floating "AI" button (bottom-right) and ask
  a question about the docs in this workspace. Watch for the
  paragraph-level citations.
- **Comments** — leave a thread on any document and resolve it from the
  same panel.
- **Versions** — edit this document, then open the version history
  card to see snapshots. Click "Diff" to compare against the current
  draft.
- **Sharing** — click "Translate", "Resolve offline edits", or open
  the Sharing & Compliance card to see permissions, sensitivity
  toggles, and notarization status.

Open the **Workspace switcher** in the dashboard header to jump into
the Legal and Clinical demo workspaces — each one has realistic
documents, comments, templates, and notarization examples.

Click **Reset demo data** on the landing page to wipe everything and
start from a blank slate.
"""


_TEMPLATES = [
    {
        "name": "meeting-notes",
        "description": "Weekly sync template with attendees + action items.",
        "content_md": (
            "# {{topic}}\n\n"
            "**Date:** {{date}}\n"
            "**Attendees:** {{attendees}}\n\n"
            "## Discussion\n\n"
            "- \n\n"
            "## Action items\n\n"
            "- [ ] \n"
        ),
        "variables": [
            {"name": "topic", "default": "Weekly sync"},
            {"name": "date"},
            {"name": "attendees"},
        ],
    },
    {
        "name": "engineering-rfc",
        "description": "Engineering RFC with context / proposal / risks sections.",
        "content_md": (
            "# RFC: {{title}}\n\n"
            "**Author:** {{author}}\n"
            "**Status:** {{status}}\n\n"
            "## Context\n\n"
            "Why we're doing this.\n\n"
            "## Proposal\n\n"
            "What we'll do.\n\n"
            "## Risks\n\n"
            "What could go wrong.\n"
        ),
        "variables": [
            {"name": "title"},
            {"name": "author"},
            {"name": "status", "default": "draft"},
        ],
    },
    {
        "name": "bug-report",
        "description": "Reproducible bug write-up with environment + steps.",
        "content_md": (
            "# Bug: {{title}}\n\n"
            "**Severity:** {{severity}}\n"
            "**Environment:** {{environment}}\n\n"
            "## Steps to reproduce\n\n"
            "{{repro_steps}}\n\n"
            "## Expected behaviour\n\n"
            "- \n\n"
            "## Actual behaviour\n\n"
            "- \n"
        ),
        "variables": [
            {"name": "title"},
            {"name": "severity", "default": "P2"},
            {"name": "environment", "default": "prod"},
            {"name": "repro_steps", "default": "1. \n2. \n3. "},
        ],
    },
]


async def _create_workspace(db: AsyncSession, slug: str, name: str) -> Workspace:
    repo = WorkspaceRepository(db)
    existing = await repo.get_by_slug(slug)
    if existing is not None:
        return existing
    return await repo.create(Workspace(slug=slug, name=name))


async def _create_doc(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    title: str,
    content_md: str,
    sensitivity: str = "public",
    created_by: str = _DEMO_USER,
) -> Document:
    doc = Document(
        workspace_id=workspace_id,
        title=title,
        content_md=content_md,
        sensitivity=sensitivity,
        created_by=created_by,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    if is_enabled("rag"):
        await reindex_document(db, doc)
    return doc


async def _create_template(db: AsyncSession, *, workspace_id: uuid.UUID, spec: dict) -> Template:
    template = Template(
        workspace_id=workspace_id,
        name=spec["name"],
        description=spec.get("description"),
        content_md=spec["content_md"],
        variables_schema=json.dumps(spec.get("variables", [])),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_demo_data(db: AsyncSession = Depends(get_db)) -> dict:
    """Populate the workspace with realistic demo content.

    Idempotent — calling twice yields the same final state because we
    reset first.
    """
    _require_enabled()

    # Reset first so seeding is repeatable.
    await reset_demo_data(db)

    counters: dict[str, int] = {}

    # --- Workspaces --------------------------------------------------------
    personal = await _create_workspace(db, DEFAULT_WORKSPACE_SLUG, "Personal")
    legal = await _create_workspace(db, "legal", "Legal")
    clinical = await _create_workspace(db, "clinical", "Clinical")
    counters["workspaces"] = 3

    # --- Templates (in personal) ------------------------------------------
    for spec in _TEMPLATES:
        await _create_template(db, workspace_id=personal.id, spec=spec)
    counters["templates"] = len(_TEMPLATES)

    # --- Personal workspace docs ------------------------------------------
    welcome = await _create_doc(
        db,
        workspace_id=personal.id,
        title="Welcome to DClaw Doc",
        content_md=_WELCOME,
        sensitivity="public",
    )

    # --- Legal workspace docs ---------------------------------------------
    # NB: all seed docs are owned by ``_DEMO_USER`` so the demo viewer can
    # interact with everything end-to-end. Realism around named collaborators
    # comes from comment authors + audit-event actors below.
    msa = await _create_doc(
        db,
        workspace_id=legal.id,
        title="Master Services Agreement — Acme Corp",
        content_md=_LEGAL_MSA,
        sensitivity="confidential",
    )
    nda = await _create_doc(
        db,
        workspace_id=legal.id,
        title="Mutual NDA — Acme Corp",
        content_md=_LEGAL_NDA,
        sensitivity="confidential",
    )
    privacy = await _create_doc(
        db,
        workspace_id=legal.id,
        title="Privacy Policy",
        content_md=_LEGAL_PRIVACY,
        sensitivity="public",
    )

    # --- Clinical workspace docs ------------------------------------------
    trial = await _create_doc(
        db,
        workspace_id=clinical.id,
        title="Phase 2 Trial Protocol — DCL-2026-002",
        content_md=_CLINICAL_TRIAL,
        sensitivity="phi",
    )
    onboarding = await _create_doc(
        db,
        workspace_id=clinical.id,
        title="Patient Onboarding Checklist",
        content_md=_CLINICAL_ONBOARDING,
        sensitivity="confidential",
    )
    irb = await _create_doc(
        db,
        workspace_id=clinical.id,
        title="IRB Submission Checklist",
        content_md=_CLINICAL_IRB,
        sensitivity="public",
    )
    counters["documents"] = 7

    # --- Versions on the MSA (snapshot before each edit) ------------------
    version_repo = DocumentVersionRepository(db)
    edits = [
        ("Master Services Agreement — Acme Corp (v2)", _LEGAL_MSA + "\n## 7. Notices\n\nNotices may be served by email.\n"),
        ("Master Services Agreement — Acme Corp (v3)", _LEGAL_MSA + "\n## 7. Notices\n\nNotices may be served by email to legal@acme.example.\n\n## 8. Force Majeure\n\nNeither party will be liable for delays caused by events beyond reasonable control.\n"),
    ]
    versions_created = 0
    for new_title, new_body in edits:
        await snapshot(version_repo, document=msa, author_id="alice@dclawstack.io")
        msa.title = new_title
        msa.content_md = new_body
        msa.updated_at = utc_now()
        await db.commit()
        await db.refresh(msa)
        versions_created += 1
    counters["versions"] = versions_created

    # --- Comments on the MSA + reply thread -------------------------------
    parent = Comment(
        document_id=msa.id,
        body="Should we reduce the liability cap to 6 months of fees?",
        author_id="alice@dclawstack.io",
    )
    db.add(parent)
    await db.commit()
    await db.refresh(parent)

    db.add(
        Comment(
            document_id=msa.id,
            parent_id=parent.id,
            body="Counter-proposal: keep 12 months but add a carve-out for IP claims.",
            author_id=_DEMO_USER,
        )
    )
    db.add(
        Comment(
            document_id=msa.id,
            body="Confidentiality clause looks good — approved.",
            author_id="bob@dclawstack.io",
            resolved_at=utc_now() - timedelta(hours=1),
        )
    )
    await db.commit()
    counters["comments"] = 3

    # --- ACL grants -------------------------------------------------------
    db.add(
        DocumentPermission(
            document_id=msa.id,
            principal_type="user",
            principal_id="bob@dclawstack.io",
            role="commenter",
        )
    )
    db.add(
        DocumentPermission(
            document_id=nda.id,
            principal_type="user",
            principal_id="bob@dclawstack.io",
            role="viewer",
        )
    )
    await db.commit()
    counters["permissions"] = 2

    # --- Sharing link on Privacy Policy -----------------------------------
    import secrets

    db.add(
        SharingLink(
            document_id=privacy.id,
            token=secrets.token_urlsafe(24),
            role="viewer",
        )
    )
    await db.commit()
    counters["sharing_links"] = 1

    # --- Notarization on the MSA ------------------------------------------
    next_ver = await version_repo.next_version_num(msa.id)
    digest = content_hash(msa, next_ver)
    signature = sign(digest)
    db.add(
        Notarization(
            document_id=msa.id,
            version_num=next_ver,
            content_hash=digest,
            signature=signature,
            notarized_by="alice@dclawstack.io",
        )
    )
    await db.commit()
    counters["notarizations"] = 1

    # --- Sign request on the NDA ------------------------------------------
    db.add(
        SignRequest(
            document_id=nda.id,
            workspace_id=legal.id,
            provider="mock",
            external_id=f"mock_{secrets.token_hex(8)}",
            signer_email="counterparty@example.com",
            signer_name="Counterparty Acme",
            status="sent",
        )
    )
    await db.commit()
    counters["sign_requests"] = 1

    # --- A handful of audit events ----------------------------------------
    audit_payloads = [
        ("document.notarize", msa.id, {"version_num": next_ver, "content_hash": digest[:12] + "..."}),
        ("sensitivity.change", trial.id, {"from": "public", "to": "phi"}),
        ("sign_request.sent", nda.id, {"signer_email": "counterparty@example.com"}),
        ("sharing_link.created", privacy.id, {"role": "viewer"}),
    ]
    for action, doc_id, payload in audit_payloads:
        db.add(
            AuditEvent(
                workspace_id=legal.id if action != "sensitivity.change" else clinical.id,
                document_id=doc_id,
                actor_id="alice@dclawstack.io" if action != "sensitivity.change" else "mreyes@clinic.example",
                action=action,
                payload=json.dumps(payload),
            )
        )
    await db.commit()
    counters["audit_events"] = len(audit_payloads)

    return {"seeded": counters}

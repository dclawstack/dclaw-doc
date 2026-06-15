# Veridoc — Agent Guide

Compliance-grade AI document workspace. Every AI output is cited, every edit is
audited, every approval is cryptographically provable. Wedge: compliance/ops
teams in regulated industries.

## Stack

- Next.js 14 (App Router, TS, Tailwind, `src/`, `@/*` alias) — full-stack on Vercel
- Neon serverless Postgres (HTTP driver) + pgvector, Drizzle ORM
- Neon Auth (Stack) when keys present; dev-user fallback otherwise
- OpenRouter for all AI (consensus router — see Phase 3)
- Auto-deploys from `main` to Vercel project `dclaw-doc-v2` (account `tharuni-01`)

## Architecture rules (these win over general defaults below)

- **Never** call `db()` at module top level — it throws if `DATABASE_URL` is
  unset and breaks the build. Call it inside route handlers / server actions.
- All identity goes through `src/lib/auth.ts` (`requireUser`/`getCurrentUser`).
  Never read Stack/cookies directly elsewhere.
- Every query is scoped by `workspaceId`. Resolve via `src/lib/workspace.ts`.
  No cross-workspace reads. Soft-deleted docs (`deletedAt` not null) are excluded.
- Every mutating route calls `logAudit(...)` (`src/lib/audit.ts`). `audit_events`
  is append-only — never UPDATE or DELETE rows.
- Server pages that query must `export const dynamic = "force-dynamic"`.
  API routes `export const runtime = "nodejs"`.
- Schema lives in `src/db/schema.ts`. App tables via `drizzle-kit push`/migrations;
  the `roadmap` schema is managed by `scripts/seed-roadmap.mjs` (drizzle-kit skips
  custom pg schemas). Don't hand-edit generated `drizzle/` files.
- Secrets only in `.env.local` (gitignored) and Vercel env vars. Never commit them.

## Build progress

Tracked in Neon, schema `roadmap` (goals/tasks/metrics). Inspect/update with
`node scripts/roadmap.mjs status|goal|task|metric`. Human summary in the root
scaffold's `REBUILD-GOAL.md`.

## Verify before done

`npm run build` must pass clean. For DB-touching changes, smoke-test against Neon
on `PORT=3020` (port 3000 is taken by another local app).

## General Agent Behavior

> **Precedence:** the architecture rules above are more specific and ALWAYS win.
> These are defaults. Bias toward caution over speed; use judgment on trivial tasks.

### 1. Think before coding
State assumptions; ask when uncertain. Present multiple interpretations rather
than silently picking one. Name a simpler approach if one exists.

### 2. Simplicity first
Minimum code that solves the problem. No speculative features, abstractions, or
error-handling beyond what was asked.

### 3. Surgical changes
Touch only what the request requires. Match existing style. Remove only what your
change orphaned; flag pre-existing dead code rather than deleting it uninvited.

### 4. Goal-driven execution
Turn vague tasks into verifiable goals with a verify-check per step; loop until
checks pass.

### 5. Docs awareness
Read the nearest `AGENTS.md` before editing; treat the closest as the local
contract. Update it in the same task when purpose/scope/structure changes.

### 6. Plan before big work
For risky or non-trivial designs, stress-test the plan one decision at a time
before implementing.

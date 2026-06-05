import Link from "next/link";

// DEMO-ONLY: <DemoControls /> below the nav lets visitors seed / reset
// the workspace. Remove this import + the render site marked DEMO-ONLY.
import { DemoControls } from "@/components/demo/controls";

import {
  ArrowRight,
  Bot,
  Clock,
  Code2,
  FileSignature,
  FileText,
  Github,
  History,
  Languages,
  Layers,
  LockKeyhole,
  MessageSquare,
  PenSquare,
  Quote,
  ScanLine,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Users2,
  Workflow,
  Zap,
} from "lucide-react";

/**
 * Public-facing landing page.
 *
 * This is a server component — there's no client interactivity here, just
 * static marketing content. The dashboard lives at /dashboard and is
 * gated by the (app) route group with its own layout (which mounts the
 * workspace copilot).
 */
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Nav />
      {/* DEMO-ONLY (remove with the rest of the demo plumbing) */}
      <DemoControls />
      <Hero />
      <Pillars />
      <FeatureGrid />
      <AIDeepDive />
      <ComplianceDeepDive />
      <CollaborationSection />
      <WorkflowSection />
      <TechStack />
      <FinalCTA />
      <Footer />
    </main>
  );
}

// ---------------- Navigation ----------------

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <FileText className="h-4 w-4" />
          </span>
          <span>DClaw Doc</span>
        </Link>
        <nav className="hidden gap-6 text-sm text-slate-700 md:flex">
          <a href="#pillars" className="hover:text-slate-900">
            Why DClaw
          </a>
          <a href="#features" className="hover:text-slate-900">
            Features
          </a>
          <a href="#ai" className="hover:text-slate-900">
            AI
          </a>
          <a href="#compliance" className="hover:text-slate-900">
            Compliance
          </a>
          <a href="#stack" className="hover:text-slate-900">
            Stack
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/dclawstack/dclaw-doc"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 sm:inline-flex"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ---------------- Hero ----------------

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[860px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 opacity-60 blur-3xl" />
      </div>
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-28 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          AI-native · open source · YC-ready
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          The document workspace where{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            every word is auditable
          </span>
          .
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Verifiable AI with paragraph-level citations, CRDT real-time
          collaboration, and audit-grade compliance — built for legal,
          clinical, and finance teams that can&apos;t afford a hallucination.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-200 hover:shadow-xl"
          >
            Open the dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/dclawstack/dclaw-doc"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-medium hover:bg-slate-50"
          >
            <Github className="h-4 w-4" />
            Read the source
          </a>
        </div>
        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="mx-auto mt-16 max-w-4xl rounded-xl border border-slate-200 bg-white p-2 shadow-2xl shadow-indigo-100">
      <div className="rounded-lg border border-slate-200 bg-slate-50">
        <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 text-xs text-slate-500">
            dclaw-doc · /docs/release-notes
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 p-4 text-left">
          <div className="col-span-2 space-y-2">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Document · v3
              </p>
              <h2 className="mt-1 text-sm font-semibold">Release notes 1.2</h2>
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <p>• Paragraph-level citations for every AI answer</p>
                <p>• CRDT collaboration via y-websocket</p>
                <p>• HMAC notarization with tamper detection</p>
                <p className="text-slate-400">Autosaved 3 s ago</p>
              </div>
            </div>
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-xs">
              <p className="font-semibold text-indigo-700">AI Copilot · mock</p>
              <p className="mt-1 text-indigo-900">
                Summarise the release notes in three bullets…
              </p>
              <p className="mt-2 text-indigo-600">
                <Quote className="mr-1 inline h-3 w-3" />
                [1] Release notes 1.2 · chunk 0
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs">
              <p className="font-semibold text-emerald-700">Verified</p>
              <p className="mt-1 text-emerald-900">signature matches</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
              <p className="font-semibold text-amber-700">PII</p>
              <p className="mt-1 text-amber-900">0 findings</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-xs">
              <p className="font-semibold">Live · 3 connected</p>
              <p className="mt-1 text-slate-500">tahir · ana · you</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Pillars ----------------

function Pillars() {
  const pillars = [
    {
      icon: ShieldCheck,
      title: "Verifiable AI",
      body: "Every AI answer carries paragraph-level citations sourced from your own documents. No more hallucinations slipping into contracts or clinical notes.",
      colour: "from-indigo-500 to-blue-600",
    },
    {
      icon: Users2,
      title: "Real-time collaboration",
      body: "CRDT-based co-editing via Yjs over WebSocket, with cursor presence, threaded comments, and offline 3-way merge when peers reconnect.",
      colour: "from-purple-500 to-fuchsia-600",
    },
    {
      icon: LockKeyhole,
      title: "Compliance from day one",
      body: "Multi-tenant from line one of the schema. Per-document ACL, PII detection, immutable audit log, and HMAC notarization with tamper detection.",
      colour: "from-emerald-500 to-teal-600",
    },
  ];

  return (
    <section id="pillars" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Built for teams that can&apos;t afford to get this wrong
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          DClaw Doc is the open-source AI document workspace for regulated
          content — where every word, every edit, and every AI suggestion is
          traceable.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm transition hover:shadow-xl"
            >
              <div
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${p.colour} text-white shadow-md`}
              >
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------- Feature Grid ----------------

const FEATURES = [
  {
    icon: Bot,
    title: "Streaming AI copilot",
    body: "SSE token stream with rewrite, summarize, translate, explain, and chat modes — accessible from every page.",
  },
  {
    icon: Quote,
    title: "Paragraph-level citations",
    body: "Every grounded answer includes a citation frame with chunk metadata that hyperlinks back to the source.",
  },
  {
    icon: Search,
    title: "Hybrid RAG search",
    body: "Embeddings + keyword overlap ranked together. Works on SQLite (sqlite-vss path) and Postgres (pgvector).",
  },
  {
    icon: Workflow,
    title: "Agentic tool-calling",
    body: "Bounded multi-step agent with search_workspace, redact_pii, summarize_doc, and create_doc_from_template tools.",
  },
  {
    icon: Users2,
    title: "Yjs real-time collaboration",
    body: "y-websocket-compatible sync endpoint, cursor presence, awareness — peer-to-peer feel, server-anchored history.",
  },
  {
    icon: MessageSquare,
    title: "Threaded comments",
    body: "Inline anchored comments with reply threads, resolve/reopen, and per-user role enforcement.",
  },
  {
    icon: History,
    title: "Version history + diff",
    body: "Snapshot on every content change. Side-by-side line diff. One-click rollback that itself takes a snapshot.",
  },
  {
    icon: Shield,
    title: "Per-document ACL",
    body: "Roles: viewer, commenter, editor, owner. Creator is owner by default. Workspace fallback when no ACL is set.",
  },
  {
    icon: FileSignature,
    title: "Cryptographic notarization",
    body: "HMAC signature of the canonical (title + body) payload. Verify endpoint detects tampering instantly.",
  },
  {
    icon: ScanLine,
    title: "Compliance metadata",
    body: "Sensitivity labels (public/confidential/PII/PHI) plus regex-based PII detection on save.",
  },
  {
    icon: Layers,
    title: "Background jobs",
    body: "Arq-shaped in-process queue with status tracking. Re-embed workspaces or translate 200-page docs without blocking.",
  },
  {
    icon: Languages,
    title: "Layout-preserving translation",
    body: "Per-block LLM translation that re-assembles headings, lists, and paragraphs with original structure intact.",
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Features
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Twelve features. One coherent system.
          </h2>
          <p className="mt-3 text-slate-600">
            Each one was built with end-to-end tests and ships behind a feature
            flag.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md"
            >
              <f.icon className="h-5 w-5 text-indigo-600" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------- AI Deep Dive ----------------

function AIDeepDive() {
  return (
    <section id="ai" className="bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            AI that&apos;s verifiable
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Citations on every paragraph. Evals on every prompt.
          </h2>
          <p className="mt-4 text-slate-600">
            We don&apos;t wrap an LLM. We ground every answer in your workspace
            via hybrid retrieval, attach chunk-level provenance to every SSE
            stream, and gate releases with a YAML-driven eval harness so quality
            regressions can&apos;t merge silently.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <Quote className="h-5 w-5 shrink-0 text-indigo-600" />
              <span>
                <strong>Inline citations</strong> — every grounded answer
                streams a <code>citations</code> SSE frame with{" "}
                <code>document_id</code>, <code>chunk_ordinal</code>, and
                similarity score.
              </span>
            </li>
            <li className="flex gap-3">
              <Bot className="h-5 w-5 shrink-0 text-indigo-600" />
              <span>
                <strong>Agentic loop</strong> — bounded tool-calling agent picks
                between <code>search_workspace</code>, <code>redact_pii</code>,
                and <code>summarize_doc</code> with full trace visibility.
              </span>
            </li>
            <li className="flex gap-3">
              <Zap className="h-5 w-5 shrink-0 text-indigo-600" />
              <span>
                <strong>Provider-swap</strong> — flip <code>AI_PROVIDER</code>{" "}
                between mock (zero deps, deterministic), Ollama, and OpenRouter
                without changing route code.
              </span>
            </li>
            <li className="flex gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-indigo-600" />
              <span>
                <strong>Eval harness</strong> — YAML golden dataset with
                must-include / must-not-include checks; non-zero exit gates CI.
              </span>
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50 p-1 shadow-xl">
          <pre className="overflow-auto rounded-xl bg-slate-950 p-5 text-xs leading-relaxed text-slate-100">
            <code>{`POST /api/v1/ai/doc-chat
Content-Type: text/event-stream

event: meta
data: {"provider":"openrouter","model":"claude-sonnet-4-6","rag_hits":3}

event: citations
data: {"citations":[
  {"document_id":"...","ordinal":7,"score":0.83,"text":"..."},
  {"document_id":"...","ordinal":2,"score":0.71,"text":"..."}
]}

event: token
data: {"content":"The release "}
event: token
data: {"content":"notes "}
event: token
data: {"content":"highlight three changes [1][2]..."}

event: usage
data: {"prompt_tokens":421,"completion_tokens":189}
event: done`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

// ---------------- Compliance ----------------

function ComplianceDeepDive() {
  return (
    <section
      id="compliance"
      className="border-y border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-slate-400">
                Audit log
              </span>
              <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">
                immutable
              </span>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                {
                  who: "alice",
                  action: "document.notarize",
                  detail: "v3 · content_hash=ab3f…",
                  time: "12:18 UTC",
                },
                {
                  who: "bob",
                  action: "sensitivity.change",
                  detail: "confidential → pii",
                  time: "12:14 UTC",
                },
                {
                  who: "webhook",
                  action: "sign_request.signed",
                  detail: "external_id=mock_8a…",
                  time: "11:52 UTC",
                },
                {
                  who: "alice",
                  action: "sharing_link.created",
                  detail: "role=viewer, expires=2026-08-31",
                  time: "11:21 UTC",
                },
              ].map((row, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-4 rounded-md border border-slate-700/60 bg-slate-900 p-3"
                >
                  <div>
                    <p className="font-mono text-xs text-indigo-300">
                      {row.action}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{row.detail}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>{row.who}</p>
                    <p>{row.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Compliance-first
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Every action is signed, scoped, and append-only.
          </h2>
          <p className="mt-4 text-slate-300">
            Regulated buyers don&apos;t want a chatbot. They want a paper trail.
            DClaw Doc was designed with audit, redaction, and verification as
            primitives — not afterthoughts you bolt on for SOC2.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <Shield className="h-5 w-5 shrink-0 text-emerald-400" />
              <span>
                <strong className="text-white">Per-document ACL</strong> —
                viewer/commenter/editor/owner enforced on every doc-touching
                route with 5 dedicated tests covering creator promotion +
                explicit overrides.
              </span>
            </li>
            <li className="flex gap-3">
              <ScanLine className="h-5 w-5 shrink-0 text-emerald-400" />
              <span>
                <strong className="text-white">PII detection</strong> — regex +
                LLM-augmented redaction for email, phone, SSN, credit-card.
                Live chip on the editor warns before sharing.
              </span>
            </li>
            <li className="flex gap-3">
              <FileSignature className="h-5 w-5 shrink-0 text-emerald-400" />
              <span>
                <strong className="text-white">Notarization</strong> — HMAC of
                the canonical document payload. Verify endpoint reproduces the
                digest from current state and flags a mismatch as{" "}
                <em>tampered</em>.
              </span>
            </li>
            <li className="flex gap-3">
              <Clock className="h-5 w-5 shrink-0 text-emerald-400" />
              <span>
                <strong className="text-white">Immutable audit log</strong> —
                append-only <code>audit_events</code> table. No PATCH, no
                DELETE.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------- Collaboration ----------------

function CollaborationSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-purple-600">
            Collaboration
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            CRDT-grade live editing. Diff3 for the offline path.
          </h2>
          <p className="mt-4 text-slate-600">
            The editor runs Yjs on top of TipTap, syncing through a native
            FastAPI WebSocket endpoint that speaks the y-websocket binary
            protocol. Drop offline and your edits queue. Reconnect and a
            backend 3-way merge resolves cleanly — or surfaces explicit
            conflict markers to you, never silently to the doc.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3">
              <PenSquare className="h-5 w-5 shrink-0 text-purple-600" />
              <span>
                <strong>TipTap block editor</strong> with debounced 1.2 s
                autosave projecting Yjs → Markdown for non-collab clients.
              </span>
            </li>
            <li className="flex gap-3">
              <Users2 className="h-5 w-5 shrink-0 text-purple-600" />
              <span>
                <strong>Cursor presence</strong> via{" "}
                <code>@tiptap/extension-collaboration-cursor</code>.
              </span>
            </li>
            <li className="flex gap-3">
              <History className="h-5 w-5 shrink-0 text-purple-600" />
              <span>
                <strong>Offline 3-way merge</strong> — submit divergent local
                edits with the base version number; server emits diff3 output
                with conflict markers.
              </span>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs text-slate-100 shadow-2xl">
            <p className="font-mono text-emerald-400">
              ws://api.dclawstack.io/api/v1/documents/&lt;id&gt;/sync
            </p>
            <pre className="mt-2 text-[11px] leading-relaxed text-slate-300">
              {`▼ Yjs sync message (binary)
▼ Workspace claim verified
▼ Replaying 14 persisted updates
✓ peer joined  ana@dclawstack.io
✓ peer joined  tahir@dclawstack.io
↻ awareness: cursor @ /3:14
↻ awareness: cursor @ /7:02`}
            </pre>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm">
            <p className="font-semibold text-purple-900">3-way merge result</p>
            <pre className="mt-2 overflow-auto whitespace-pre text-xs text-purple-900">
              {`alpha
<<<<<<< server
BETA
=======
beta-local
>>>>>>> local
gamma`}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Workflows ----------------

function WorkflowSection() {
  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Workflows
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Templates, signatures, OCR, exports — wired in.
          </h2>
          <p className="mt-3 text-slate-600">
            The day-to-day operations a real workspace needs. Each one is a
            real route, real tests, and a real UI on the doc page.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: PenSquare,
              title: "Templates",
              body: "Variable-driven document templates with schema-backed forms. Render to a new doc in one click.",
            },
            {
              icon: FileSignature,
              title: "E-signature",
              body: "Provider abstraction (Mock today, DocuSign-shaped tomorrow). Webhook updates status; every event audited.",
            },
            {
              icon: ScanLine,
              title: "OCR + vision",
              body: "Image → text via the configured vision provider (Mock or Ollama llava). Save the transcript as a doc.",
            },
            {
              icon: Languages,
              title: "Export & import",
              body: "Round-trip through Markdown, HTML, JSON. Bring in legacy docs via the markdown importer.",
            },
          ].map((w) => (
            <div
              key={w.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <w.icon className="h-5 w-5 text-indigo-600" />
              <h3 className="mt-3 font-semibold">{w.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{w.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------- Tech Stack ----------------

function TechStack() {
  const items = [
    "FastAPI",
    "SQLAlchemy 2.0",
    "Pydantic v2",
    "Alembic",
    "Next.js 14",
    "TipTap",
    "Yjs",
    "y-websocket",
    "Tailwind",
    "structlog",
    "Logto-ready JWT",
    "OpenRouter · Ollama",
    "Stripe-ready",
    "Helm + K8s",
  ];
  return (
    <section id="stack" className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20 text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Tech
        </span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          The boring, durable stack
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          We pick the technology that scales without rewrites. Multi-tenant
          schema from day one. SQLite locally, Postgres in production. 100%
          open source.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-sm">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700"
            >
              <Code2 className="h-3.5 w-3.5 text-indigo-600" />
              {item}
            </span>
          ))}
        </div>
        <p className="mt-12 text-xs text-slate-500">
          59 backend tests + 5 ACL tests · 64 passing on SQLite in-memory ·
          14 alembic migrations · all idempotent
        </p>
      </div>
    </section>
  );
}

// ---------------- Final CTA ----------------

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-slate-900 text-white">
      <div className="absolute inset-0 -z-10 opacity-40">
        <div className="absolute -left-32 top-0 h-[420px] w-[520px] rounded-full bg-indigo-500 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-[320px] w-[420px] rounded-full bg-purple-500 blur-3xl" />
      </div>
      <div className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Open the workspace. Try every feature.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          Local dev runs on SQLite — no Postgres, no LLM key, no setup. The
          mock providers are deterministic so every UI works end-to-end the
          moment you boot.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-lg hover:bg-slate-100"
          >
            Open dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/dclawstack/dclaw-doc"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-white/30 px-5 py-3 text-sm font-medium hover:bg-white/10"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

// ---------------- Footer ----------------

function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <span>DClaw Doc</span>
          <span className="text-slate-600">·</span>
          <span className="text-xs">© {new Date().getFullYear()} DClaw Stack</span>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <Link href="/dashboard" className="hover:text-white">
            Dashboard
          </Link>
          <a href="#features" className="hover:text-white">
            Features
          </a>
          <a href="#ai" className="hover:text-white">
            AI
          </a>
          <a href="#compliance" className="hover:text-white">
            Compliance
          </a>
          <a
            href="https://github.com/dclawstack/dclaw-doc"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

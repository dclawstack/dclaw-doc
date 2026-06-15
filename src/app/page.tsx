import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  GitBranch,
  History,
  Lock,
  MessageSquare,
  ScanSearch,
  ScrollText,
  Share2,
  ShieldCheck,
  Sparkles,
  Download,
} from "lucide-react";
import { DemoControls } from "@/components/DemoControls";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <Nav />
      <Hero />
      <LogosStrip />
      <CitedAiSection />
      <TrustSection />
      <CollaborateSection />
      <DemoFlowSection />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          Veridoc
        </span>
        <nav className="hidden items-center gap-6 text-sm text-zinc-500 sm:flex">
          <a href="#cited-ai" className="hover:text-zinc-900">Copilot</a>
          <a href="#trust" className="hover:text-zinc-900">Trust</a>
          <a href="#collaborate" className="hover:text-zinc-900">Collaborate</a>
        </nav>
        <Link
          href="/dashboard"
          className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
        >
          Open app →
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,theme(colors.indigo.50),transparent)]" />
      <div className="mx-auto max-w-3xl px-6 pb-8 pt-20 text-center sm:pt-28">
        <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <Sparkles className="h-3.5 w-3.5" />
          For compliance &amp; ops teams in regulated industries
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Documents your auditors
          <br className="hidden sm:block" /> will believe.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          Veridoc is the document workspace where every AI answer is{" "}
          <span className="font-medium text-zinc-900">cited</span>, every edit is{" "}
          <span className="font-medium text-zinc-900">audited</span>, and every
          approval is{" "}
          <span className="font-medium text-zinc-900">cryptographically provable</span>.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            Open the workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#cited-ai"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            See the features
          </a>
        </div>

        {/* DEMO MODE — remove this block for production (see DEMO.md). */}
        <DemoControls />
      </div>

      <HeroMock />
    </section>
  );
}

/** A faux product screenshot: a cited copilot answer over a document. */
function HeroMock() {
  return (
    <div className="mx-auto mt-6 max-w-4xl px-6 pb-20">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
        <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="ml-3 text-xs text-zinc-400">veridoc — Vendor Data Processing Agreement</span>
        </div>
        <div className="grid gap-0 sm:grid-cols-[1fr_300px]">
          <div className="border-r border-zinc-100 p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">v3</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">approved</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">confidential</span>
            </div>
            <h3 className="text-lg font-semibold">Vendor Data Processing Agreement</h3>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-500">
              <p>The processor shall retain personal data for no longer than 90 days after contract termination…</p>
              <p>Data breaches must be reported to the controller within 24 hours of detection.</p>
            </div>
          </div>
          <div className="bg-zinc-50/60 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Copilot
            </div>
            <p className="text-xs font-medium text-zinc-700">How long can data be retained?</p>
            <p className="mt-1.5 text-xs leading-5 text-zinc-600">
              Personal data is retained for no longer than 90 days after
              termination, then securely deleted&nbsp;
              <span className="rounded bg-indigo-100 px-1 text-indigo-700">[1]</span>.
            </p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
              [1] Vendor DPA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogosStrip() {
  const items = ["Legal", "Clinical", "Fintech", "Insurance", "Pharma"];
  return (
    <div className="border-y border-zinc-100 bg-zinc-50/50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6 text-sm font-medium text-zinc-400">
        <span className="text-xs uppercase tracking-wide">Built for</span>
        {items.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  );
}

function CitedAiSection() {
  return (
    <Section id="cited-ai">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow icon={<Sparkles className="h-4 w-4" />}>AI you can defend</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Cited answers, not confident guesses
          </h2>
          <p className="mt-4 text-zinc-600">
            The copilot answers strictly from your own documents and attaches a
            citation to every claim. Click any citation to jump straight to the
            source passage. When the answer isn&apos;t in your documents, it says
            so — it never makes things up.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-600">
            <Bullet>Retrieval-augmented over your workspace (pgvector + hybrid search)</Bullet>
            <Bullet>Streaming responses with inline, clickable citations</Bullet>
            <Bullet>Refuses to answer outside the provided context</Bullet>
          </ul>
        </div>
        <Card className="p-6">
          <div className="space-y-3">
            <div className="ml-auto w-fit rounded-2xl rounded-br-sm bg-indigo-600 px-3.5 py-2 text-sm text-white">
              What&apos;s our breach notification deadline?
            </div>
            <div className="w-fit rounded-2xl rounded-bl-sm bg-zinc-100 px-3.5 py-2 text-sm text-zinc-700">
              Breaches must be reported to the controller within 24 hours of
              detection{" "}
              <span className="rounded bg-indigo-100 px-1 text-xs text-indigo-700">[1]</span>.
            </div>
            <div className="flex gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                [1] Incident Response Runbook
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function TrustSection() {
  return (
    <Section id="trust" muted>
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow icon={<ShieldCheck className="h-4 w-4" />} center>
          The trust layer
        </Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Every action is provable
        </h2>
        <p className="mt-4 text-zinc-600">
          The things compliance teams actually get asked for — who changed what,
          how sensitive it is, and whether an approval still holds.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <FeatureCard
          icon={<ScrollText className="h-5 w-5 text-indigo-600" />}
          title="Append-only audit log"
          body="Every create, edit, approval, comment, and share is written to an immutable trail — never updated, never deleted."
        />
        <FeatureCard
          icon={<ScanSearch className="h-5 w-5 text-indigo-600" />}
          title="Consensus PII detection"
          body="A diverse 3-model panel votes on each document's sensitivity (PII/PHI), so a single model's miss can't mislabel sensitive data."
        />
        <FeatureCard
          icon={<BadgeCheck className="h-5 w-5 text-indigo-600" />}
          title="Cryptographic notarization"
          body="Approving a document records a tamper-evident SHA-256 of its content. Anyone can verify later that what was approved hasn't changed."
        />
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <FeatureCard
          icon={<Lock className="h-5 w-5 text-indigo-600" />}
          title="Sensitivity tags"
          body="Label documents public, confidential, PII, or PHI — and see the classification at a glance everywhere."
        />
        <FeatureCard
          icon={<Share2 className="h-5 w-5 text-indigo-600" />}
          title="Expiring share links"
          body="Share a read-only view via a tokenized link with an expiry, and revoke it instantly. No account required to view."
        />
      </div>
    </Section>
  );
}

function CollaborateSection() {
  const features = [
    {
      icon: <FileText className="h-5 w-5 text-indigo-600" />,
      title: "Templates",
      body: "Reusable documents with {{variables}} you fill in on use — NDAs, incident reports, intake forms.",
    },
    {
      icon: <MessageSquare className="h-5 w-5 text-indigo-600" />,
      title: "Threaded comments",
      body: "Discuss inline, reply in threads, and resolve when settled. Every comment is audited.",
    },
    {
      icon: <History className="h-5 w-5 text-indigo-600" />,
      title: "Version history",
      body: "Every edit snapshots a new version. Compare and restore any prior version in one click.",
    },
    {
      icon: <GitBranch className="h-5 w-5 text-indigo-600" />,
      title: "Rich editor + autosave",
      body: "A block-based editor that saves as you type and indexes content for the copilot automatically.",
    },
    {
      icon: <Download className="h-5 w-5 text-indigo-600" />,
      title: "Export & import",
      body: "Download any document as Markdown, HTML, or JSON — or import a Markdown file as a new document.",
    },
    {
      icon: <ScrollText className="h-5 w-5 text-indigo-600" />,
      title: "Usage metering",
      body: "See AI token spend by model. Cheap models do routine work; consensus runs only when it matters.",
    },
  ];
  return (
    <Section id="collaborate">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow icon={<MessageSquare className="h-4 w-4" />} center>
          Built for real work
        </Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Everything a document team needs
        </h2>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} icon={f.icon} title={f.title} body={f.body} />
        ))}
      </div>
    </Section>
  );
}

function DemoFlowSection() {
  const steps = [
    { n: 1, t: "Ask", d: "Ask the copilot a question about your documents." },
    { n: 2, t: "Cited answer", d: "Get a streamed answer with clickable citations into your sources." },
    { n: 3, t: "Approve", d: "Approve the document — a verifiable SHA-256 is recorded." },
    { n: 4, t: "Audit trail", d: "The whole chain shows up in the immutable audit log." },
  ];
  return (
    <Section muted>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight">The 90-second demo</h2>
        <p className="mt-3 text-zinc-600">
          Load the demo data above, open the workspace, and walk the loop.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.n} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
              {s.n}
            </div>
            <h3 className="font-semibold">{s.t}</h3>
            <p className="mt-1 text-sm text-zinc-600">{s.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl rounded-3xl bg-zinc-900 px-8 py-16 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          See it with real content
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-zinc-300">
          Load the demo dataset and open the workspace — folders, documents
          across every sensitivity level, approvals, comments, and templates are
          ready to explore.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Open the workspace
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-400">
      Veridoc — compliance-grade document workspace
    </footer>
  );
}

// ---------- small presentational helpers ----------

function Section({
  id,
  muted,
  children,
}: {
  id?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={muted ? "bg-zinc-50/60" : ""}>
      <div className="mx-auto max-w-5xl px-6 py-20">{children}</div>
    </section>
  );
}

function Eyebrow({
  icon,
  center,
  children,
}: {
  icon: React.ReactNode;
  center?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ${
        center ? "mx-auto" : ""
      }`}
    >
      {icon}
      {children}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
      <span>{children}</span>
    </li>
  );
}

function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-3 inline-flex rounded-lg bg-indigo-50 p-2">{icon}</div>
      <h3 className="mb-1.5 font-semibold">{title}</h3>
      <p className="text-sm leading-6 text-zinc-600">{body}</p>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Veridoc
          </span>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Open app →
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            For compliance &amp; ops teams in regulated industries
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Documents your auditors will believe.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            The document workspace where every AI answer is cited, every edit is
            audited, and every approval is cryptographically provable.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            >
              Open the workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="border-t border-zinc-100 bg-zinc-50/60">
          <div className="mx-auto grid max-w-5xl gap-6 px-6 py-16 sm:grid-cols-3">
            <Feature
              icon={<Sparkles className="h-5 w-5 text-indigo-600" />}
              title="Cited AI, not guesses"
              body="The copilot answers only from your documents and cites the exact passages — click any citation to jump to the source."
            />
            <Feature
              icon={<ScrollText className="h-5 w-5 text-indigo-600" />}
              title="Everything audited"
              body="Every create, edit, approval, and share is written to an append-only audit log. Sensitivity tags (PII/PHI) are detected by a multi-model consensus."
            />
            <Feature
              icon={<BadgeCheck className="h-5 w-5 text-indigo-600" />}
              title="Provable approvals"
              body="Approving a document records a tamper-evident SHA-256 of its content. Anyone can verify later that what was approved hasn't changed."
            />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            The 90-second demo
          </h2>
          <p className="mt-3 text-zinc-600">
            Ask the copilot a question → get a cited answer from your own docs →
            approve the document → it&apos;s notarized with a verifiable hash →
            the whole chain shows up in the audit trail.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Try it now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400">
        Veridoc — compliance-grade document workspace
      </footer>
    </div>
  );
}

function Feature({
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

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Veridoc
          </span>
        </div>
      </header>
      <main className="flex flex-1 items-center">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Documents your auditors will believe.
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600">
            The document workspace where every AI output is cited, every edit
            is audited, and every approval is cryptographically provable.
          </p>
          <div className="mt-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            >
              Open app
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400">
        Veridoc — compliance-grade document workspace
      </footer>
    </div>
  );
}

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { resolveShareToken } from "@/lib/share";
import { renderDocText } from "@/lib/render";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const doc = await resolveShareToken(params.token);

  if (!doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
        <p className="text-sm text-zinc-500">
          This link is invalid, expired, or has been revoked.
        </p>
      </div>
    );
  }

  const body = renderDocText(doc.contentJson, doc.contentMd);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-semibold">Veridoc</span>
          <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
            Shared · read-only
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">
          {doc.title}
        </h1>
        <article className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-700">
          {body || <span className="text-zinc-400">This document is empty.</span>}
        </article>
        <p className="mt-12 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
          Shared via{" "}
          <Link href="/" className="font-medium text-indigo-600">
            Veridoc
          </Link>{" "}
          — documents your auditors will believe.
        </p>
      </main>
    </div>
  );
}

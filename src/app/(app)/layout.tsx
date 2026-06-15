import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900"
            >
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Veridoc
            </Link>
            <Link
              href="/usage"
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              Usage
            </Link>
          </div>
          <div className="text-sm text-zinc-500">{user?.name ?? "Guest"}</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

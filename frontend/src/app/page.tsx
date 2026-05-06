import Link from "next/link";
import { FileEdit } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <FileEdit className="h-16 w-16 text-[#2563EB] mb-6" />
      <h1 className="text-4xl font-bold text-[#2563EB] mb-4">DClaw Doc</h1>
      <p className="text-lg text-gray-600 mb-8">Smart documents & collaborative editing</p>
      <Link
        href="/dashboard"
        className="rounded-md bg-[#2563EB] px-6 py-3 text-white font-medium hover:bg-[#1d4ed8] transition-colors"
      >
        Open Dashboard
      </Link>
    </main>
  );
}

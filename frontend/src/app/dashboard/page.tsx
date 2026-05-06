"use client";

import { useState } from "react";
import { FileEdit } from "lucide-react";

export default function Dashboard() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [results, setResults] = useState<{
    versionHistory: { version: number; created_at: string }[];
    collaborators: string[];
    suggestions: string[];
  } | null>(null);

  const handleSave = () => {
    setResults({
      versionHistory: [{ version: 1, created_at: new Date().toISOString() }],
      collaborators: ["Alice", "Bob"],
      suggestions: ["Add a table of contents", "Clarify section 3"],
    });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-[#2563EB] px-6 py-4 flex items-center gap-3">
        <FileEdit className="h-6 w-6 text-white" />
        <h1 className="text-xl font-semibold text-white">DClaw Doc</h1>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Editor</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document title</label>
            <textarea
              className="w-full h-16 rounded-lg border border-gray-300 p-4 text-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none resize-none"
              placeholder="Enter title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              className="w-full h-80 rounded-lg border border-gray-300 p-4 text-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none resize-none"
              placeholder="Start typing..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <button
            onClick={handleSave}
            className="rounded-md bg-[#2563EB] px-6 py-3 text-white font-medium hover:bg-[#1d4ed8] transition-colors"
          >
            Save Draft
          </button>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Results</h2>
          {results ? (
            <div className="space-y-6">
              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Version History</h3>
                <ul className="space-y-2">
                  {results.versionHistory.map((v, i) => (
                    <li key={i} className="text-gray-800 text-sm">v{v.version} — {new Date(v.created_at).toLocaleString()}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Collaborators</h3>
                <div className="flex flex-wrap gap-2">
                  {results.collaborators.map((c, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-[#2563EB]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Suggestions</h3>
                <ul className="space-y-2">
                  {results.suggestions.map((s, i) => (
                    <li key={i} className="text-gray-800 text-sm">• {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white p-12 shadow-sm border border-gray-200 text-center text-gray-500">
              Save a draft to see results
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

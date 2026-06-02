"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobRecord, enqueueJob, listJobs } from "@/lib/api";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  running: "secondary",
  succeeded: "default",
  failed: "destructive",
};

const STATUSES = ["all", "queued", "running", "succeeded", "failed"] as const;
type StatusFilter = (typeof STATUSES)[number];

const KINDS = [
  { value: "doc.reindex_all", label: "Re-embed all documents" },
] as const;

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [autorefresh, setAutorefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enqueueKind, setEnqueueKind] =
    useState<(typeof KINDS)[number]["value"]>("doc.reindex_all");

  const refresh = useCallback(async () => {
    try {
      const filter = status === "all" ? undefined : status;
      setJobs(await listJobs({ status: filter, limit: 100 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autorefresh) return;
    const handle = setInterval(refresh, 3000);
    return () => clearInterval(handle);
  }, [autorefresh, refresh]);

  async function handleEnqueue() {
    try {
      await enqueueJob({ kind: enqueueKind, payload: {} });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Background jobs</h1>
            <p className="text-sm text-gray-600">
              Long-running tasks run on the worker queue. Watch their status here.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
            ← Dashboard
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Enqueue a job</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm">
            <select
              aria-label="Job kind"
              value={enqueueKind}
              onChange={(e) =>
                setEnqueueKind(e.target.value as (typeof KINDS)[number]["value"])
              }
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <Button onClick={handleEnqueue}>Run now</Button>
            <span className="text-xs text-gray-500">
              · custom jobs can be enqueued via <code>POST /api/v1/jobs</code>
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Jobs ({jobs.length})</CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`rounded-full border px-2 py-0.5 ${
                      status === s
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1">
                <input
                  aria-label="Auto-refresh"
                  type="checkbox"
                  checked={autorefresh}
                  onChange={(e) => setAutorefresh(e.target.checked)}
                />
                auto-refresh
              </label>
              <Button variant="outline" size="sm" onClick={refresh}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-red-600">Error: {error}</p>}
            {jobs.length === 0 ? (
              <p className="text-sm text-gray-500">No jobs yet for this filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Took</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => {
                    const tookMs =
                      j.started_at && j.finished_at
                        ? Math.max(
                            0,
                            new Date(j.finished_at).getTime() -
                              new Date(j.started_at).getTime(),
                          )
                        : null;
                    return (
                      <TableRow key={j.id}>
                        <TableCell className="font-mono text-xs">{j.kind}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[j.status] ?? "outline"}>
                            {j.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(j.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {tookMs !== null ? `${tookMs} ms` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {j.status === "failed" && j.error && (
                            <span className="text-red-600">{j.error}</span>
                          )}
                          {j.status === "succeeded" && j.result && (
                            <code className="text-gray-700">
                              {j.result.slice(0, 80)}
                              {j.result.length > 80 ? "…" : ""}
                            </code>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

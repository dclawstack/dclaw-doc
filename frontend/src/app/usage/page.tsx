"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UsageRow, listUsage } from "@/lib/api";

interface Totals {
  prompt_tokens: number;
  completion_tokens: number;
  requests: number;
}

export default function UsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRows(await listUsage());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totals = useMemo<Totals>(
    () =>
      rows.reduce<Totals>(
        (acc, r) => ({
          prompt_tokens: acc.prompt_tokens + r.prompt_tokens,
          completion_tokens: acc.completion_tokens + r.completion_tokens,
          requests: acc.requests + r.requests,
        }),
        { prompt_tokens: 0, completion_tokens: 0, requests: 0 },
      ),
    [rows],
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Usage</h1>
            <p className="text-sm text-gray-600">
              Per-day token usage for this workspace. Cost ≈ tokens × model price.
            </p>
          </div>
          <Link href="/" className="text-sm text-indigo-600 hover:underline">
            ← Dashboard
          </Link>
        </header>

        <div className="grid grid-cols-3 gap-4">
          <SummaryCard label="Requests" value={totals.requests.toLocaleString()} />
          <SummaryCard label="Prompt tokens" value={totals.prompt_tokens.toLocaleString()} />
          <SummaryCard
            label="Completion tokens"
            value={totals.completion_tokens.toLocaleString()}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>By day · provider · model</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-red-600">Error: {error}</p>}
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500">
                No AI usage recorded yet. Trigger the copilot panel from any page.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Prompt tok.</TableHead>
                    <TableHead className="text-right">Completion tok.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={`${r.date}-${r.provider}-${r.model}`}>
                      <TableCell className="text-xs">{r.date}</TableCell>
                      <TableCell className="text-xs">{r.provider}</TableCell>
                      <TableCell className="text-xs">{r.model}</TableCell>
                      <TableCell className="text-right">{r.requests}</TableCell>
                      <TableCell className="text-right">
                        {r.prompt_tokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.completion_tokens.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

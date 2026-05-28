"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TemplateRecord,
  TemplateVariableSpec,
  listTemplates,
  renderTemplate,
} from "@/lib/api";

function parseVariables(schemaJson: string): TemplateVariableSpec[] {
  try {
    const parsed = JSON.parse(schemaJson);
    if (Array.isArray(parsed)) return parsed as TemplateVariableSpec[];
  } catch {
    // ignore — return empty
  }
  return [];
}

export function TemplatesPicker() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [active, setActive] = useState<TemplateRecord | null>(null);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTemplates(await listTemplates());
    } catch {
      // templates feature flag may be off — silently skip
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function startFrom(template: TemplateRecord) {
    setActive(template);
    setTitle(template.name);
    const seeded: Record<string, string> = {};
    for (const v of parseVariables(template.variables_schema)) {
      seeded[v.name] = v.default ?? "";
    }
    setValues(seeded);
  }

  async function handleRender() {
    if (!active) return;
    setSubmitting(true);
    try {
      const doc = await renderTemplate(active.id, {
        title: title.trim() || active.name,
        variables: values,
      });
      router.push(`/docs/${doc.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (templates.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!active ? (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => startFrom(t)}
                  className="flex w-full flex-col rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-medium">{t.name}</span>
                  {t.description && (
                    <span className="mt-0.5 text-xs text-gray-500">{t.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">From "{active.name}"</h3>
              <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
                Back
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="template-doc-title">Document title</Label>
              <Input
                id="template-doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            {parseVariables(active.variables_schema).map((v) => (
              <div key={v.name} className="space-y-1">
                <Label htmlFor={`var-${v.name}`}>{v.label ?? v.name}</Label>
                <Input
                  id={`var-${v.name}`}
                  value={values[v.name] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                  }
                  placeholder={v.default ?? ""}
                />
              </div>
            ))}
            <Button onClick={handleRender} disabled={submitting}>
              {submitting ? "Creating…" : "Create document"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

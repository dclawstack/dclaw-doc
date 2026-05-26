const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    cache: "no-store",
    ...options,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(`API error ${response.status}: ${error}`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function getHealth() {
  return fetchJson<{ status: string }>("/health/");
}

export interface DocumentRecord {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  content_md: string;
  content_json: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  items: DocumentRecord[];
  total: number;
  limit: number;
  offset: number;
}

export async function listDocuments(params?: { q?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.offset !== undefined) search.set("offset", String(params.offset));
  const qs = search.toString();
  return fetchJson<DocumentListResponse>(`/api/v1/documents${qs ? `?${qs}` : ""}`);
}

export async function createDocument(payload: { title: string; content_md?: string }) {
  return fetchJson<DocumentRecord>("/api/v1/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDocument(id: string) {
  return fetchJson<DocumentRecord>(`/api/v1/documents/${id}`);
}

export async function updateDocument(id: string, payload: Partial<Pick<DocumentRecord, "title" | "content_md" | "status">>) {
  return fetchJson<DocumentRecord>(`/api/v1/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDocument(id: string) {
  return fetchJson<void>(`/api/v1/documents/${id}`, { method: "DELETE" });
}

export { ApiError };

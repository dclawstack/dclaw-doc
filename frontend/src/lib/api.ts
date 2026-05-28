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
  sensitivity?: "public" | "confidential" | "pii" | "phi";
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

export interface DocumentVersionSummary {
  version_num: number;
  title: string;
  author_id: string | null;
  created_at: string;
}

export async function listDocumentVersions(id: string) {
  return fetchJson<DocumentVersionSummary[]>(`/api/v1/documents/${id}/versions`);
}

export async function restoreDocumentVersion(id: string, versionNum: number) {
  return fetchJson<DocumentRecord>(
    `/api/v1/documents/${id}/versions/${versionNum}/restore`,
    { method: "POST" },
  );
}

export type CopilotMode = "rewrite" | "summarize" | "translate" | "explain" | "chat";

export interface Citation {
  document_id: string;
  chunk_id: string;
  ordinal: number;
  text: string;
  score: number;
  document_title: string;
}

export interface CopilotStreamHandlers {
  onMeta?: (meta: { provider: string; model: string; rag_hits?: number }) => void;
  onCitations?: (citations: Citation[]) => void;
  onToken?: (token: string) => void;
  onUsage?: (usage: { prompt_tokens: number | null; completion_tokens: number | null }) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

async function consumeSseStream(
  url: string,
  payload: Record<string, unknown>,
  handlers: CopilotStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new ApiError(`AI stream failed: ${response.status}`, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      // SSE frames are separated by a blank line.
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        let event = "message";
        let dataLine = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
        }
        if (!dataLine) continue;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataLine);
        } catch {
          continue;
        }
        if (event === "meta") {
          handlers.onMeta?.(parsed as { provider: string; model: string; rag_hits?: number });
        } else if (event === "citations" && Array.isArray(parsed.citations)) {
          handlers.onCitations?.(parsed.citations as Citation[]);
        } else if (event === "token" && typeof parsed.content === "string") {
          handlers.onToken?.(parsed.content);
        } else if (event === "usage") {
          handlers.onUsage?.(parsed as { prompt_tokens: number | null; completion_tokens: number | null });
        } else if (event === "done") {
          handlers.onDone?.();
        }
      }
    }
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") return;
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function streamDocChat(
  payload: { prompt: string; document_id?: string; selection?: string; mode?: CopilotMode },
  handlers: CopilotStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  return consumeSseStream(`${API_BASE}/api/v1/ai/doc-chat`, payload, handlers, signal);
}

export async function streamWorkspaceChat(
  payload: { prompt: string; top_k?: number },
  handlers: CopilotStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  return consumeSseStream(`${API_BASE}/api/v1/ai/chat`, payload, handlers, signal);
}

// --- Comments ---

export interface CommentRecord {
  id: string;
  document_id: string;
  parent_id: string | null;
  anchor_block_id: string | null;
  body: string;
  author_id: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listComments(docId: string) {
  return fetchJson<CommentRecord[]>(`/api/v1/documents/${docId}/comments`);
}

export async function createComment(
  docId: string,
  payload: { body: string; parent_id?: string; anchor_block_id?: string },
) {
  return fetchJson<CommentRecord>(`/api/v1/documents/${docId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateComment(commentId: string, payload: { body?: string; resolved?: boolean }) {
  return fetchJson<CommentRecord>(`/api/v1/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteComment(commentId: string) {
  return fetchJson<void>(`/api/v1/comments/${commentId}`, { method: "DELETE" });
}

// --- Permissions + sharing links ---

export type DocRole = "viewer" | "commenter" | "editor" | "owner";

export interface PermissionRecord {
  id: string;
  document_id: string;
  principal_type: "user" | "link";
  principal_id: string;
  role: DocRole;
  created_at: string;
}

export interface SharingLinkRecord {
  id: string;
  document_id: string;
  token: string;
  role: DocRole;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export async function listPermissions(docId: string) {
  return fetchJson<PermissionRecord[]>(`/api/v1/documents/${docId}/permissions`);
}

export async function grantPermission(
  docId: string,
  payload: { principal_type: "user" | "link"; principal_id: string; role: DocRole },
) {
  return fetchJson<PermissionRecord>(`/api/v1/documents/${docId}/permissions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokePermission(docId: string, permissionId: string) {
  return fetchJson<void>(`/api/v1/documents/${docId}/permissions/${permissionId}`, {
    method: "DELETE",
  });
}

export async function listSharingLinks(docId: string) {
  return fetchJson<SharingLinkRecord[]>(`/api/v1/documents/${docId}/sharing-links`);
}

export async function createSharingLink(docId: string, payload: { role: DocRole; expires_at?: string | null }) {
  return fetchJson<SharingLinkRecord>(`/api/v1/documents/${docId}/sharing-links`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeSharingLink(linkId: string) {
  return fetchJson<void>(`/api/v1/sharing-links/${linkId}`, { method: "DELETE" });
}

// --- Sensitivity + notarization + audit ---

export type Sensitivity = "public" | "confidential" | "pii" | "phi";

export async function setSensitivity(docId: string, sensitivity: Sensitivity) {
  return fetchJson<{ sensitivity: Sensitivity }>(`/api/v1/documents/${docId}/sensitivity`, {
    method: "PATCH",
    body: JSON.stringify({ sensitivity }),
  });
}

export interface NotarizationRecord {
  id: string;
  document_id: string;
  version_num: number;
  content_hash: string;
  signature: string;
  notarized_by: string;
  created_at: string;
}

export async function notarizeDocument(docId: string) {
  return fetchJson<NotarizationRecord>(`/api/v1/documents/${docId}/notarize`, {
    method: "POST",
  });
}

export interface NotarizationVerify {
  valid: boolean;
  notarization_id: string;
  expected_signature: string;
  current_content_hash: string;
}

export async function verifyNotarization(docId: string) {
  try {
    return await fetchJson<NotarizationVerify>(`/api/v1/documents/${docId}/notarization`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// --- Templates ---

export interface TemplateRecord {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  content_md: string;
  variables_schema: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface TemplateVariableSpec {
  name: string;
  label?: string;
  default?: string;
}

export async function listTemplates() {
  return fetchJson<TemplateRecord[]>(`/api/v1/templates`);
}

export async function renderTemplate(
  templateId: string,
  payload: { title?: string; variables?: Record<string, string> },
) {
  return fetchJson<DocumentRecord>(`/api/v1/templates/${templateId}/render`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// --- Usage ---

export interface UsageRow {
  workspace_id: string;
  date: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  requests: number;
  updated_at: string;
}

export async function listUsage(since?: string) {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  return fetchJson<UsageRow[]>(`/api/v1/usage${qs}`);
}

export { ApiError };

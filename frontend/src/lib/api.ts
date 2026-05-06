export interface Doc {
  id: string;
  title: string;
  content: string;
  version: number;
  collaborators: string[];
  suggestions: string[];
  created_at: string;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

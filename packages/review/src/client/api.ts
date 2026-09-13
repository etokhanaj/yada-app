import type {
  DecisionRequest,
  DecisionResponse,
  EntryResponse,
  ErrorResponse,
  MetaResponse,
  QueueResponse,
  ReviewQueue,
} from "../shared/api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({ error: `${res.status} ${res.statusText}` }))) as
    | T
    | ErrorResponse;
  if (!res.ok) {
    const message = (body as Partial<ErrorResponse>).error;
    throw new Error(message ?? `${res.status} ${res.statusText}`);
  }
  return body as T;
}

export function fetchMeta(): Promise<MetaResponse> {
  return request<MetaResponse>("/api/meta");
}

export function fetchQueue(queue: ReviewQueue): Promise<QueueResponse> {
  return request<QueueResponse>(`/api/queues/${queue}`);
}

export function fetchEntry(verseId: string): Promise<EntryResponse> {
  return request<EntryResponse>(`/api/entries/${encodeURIComponent(verseId)}`);
}

export function postDecision(
  verseId: string,
  action: "approve" | "reject",
  body: DecisionRequest,
): Promise<DecisionResponse> {
  return request<DecisionResponse>(`/api/entries/${encodeURIComponent(verseId)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

import type {
  DebatesResponse,
  DecisionRequest,
  DecisionResponse,
  EntryResponse,
  ErrorResponse,
  ExtractDecisionResponse,
  ExtractKind,
  ExtractsResponse,
  MetaResponse,
  PositionAction,
  PositionDecisionRequest,
  PositionDecisionResponse,
  QueueResponse,
  ReportAction,
  ReportDecisionResponse,
  ReportsResponse,
  ReviewQueue,
  SummariesResponse,
  SummaryAction,
  SummaryDecisionRequest,
  SummaryDecisionResponse,
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

export function fetchExtracts(): Promise<ExtractsResponse> {
  return request<ExtractsResponse>("/api/extracts");
}

/** One item per request, naming the text that was read. */
export function postExtract(kind: ExtractKind, id: string, action: PositionAction, textSha256: string): Promise<ExtractDecisionResponse> {
  const body: PositionDecisionRequest = { text_sha256: textSha256 };
  return request<ExtractDecisionResponse>(`/api/extracts/${kind}/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchReports(): Promise<ReportsResponse> {
  return request<ReportsResponse>("/api/reports");
}

export function postReport(id: string, action: ReportAction): Promise<ReportDecisionResponse> {
  return request<ReportDecisionResponse>(`/api/reports/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

export function fetchDebates(): Promise<DebatesResponse> {
  return request<DebatesResponse>("/api/debates");
}

/** One position per request: the server refuses anything else. */
export function postPosition(
  passageId: string,
  index: number,
  action: PositionAction,
  textSha256: string,
  label?: { side: string } | { axis: string },
): Promise<PositionDecisionResponse> {
  const body: PositionDecisionRequest = { text_sha256: textSha256, ...label };
  return request<PositionDecisionResponse>(
    `/api/debates/${encodeURIComponent(passageId)}/positions/${index}/${action}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export function fetchSummaries(): Promise<SummariesResponse> {
  return request<SummariesResponse>("/api/summaries");
}

/** One summary per request, naming the text on screen. */
export function postSummary(
  passageId: string,
  action: SummaryAction,
  textSha256: string,
  note?: string,
): Promise<SummaryDecisionResponse> {
  const body: SummaryDecisionRequest = note === undefined ? { text_sha256: textSha256 } : { text_sha256: textSha256, note };
  return request<SummaryDecisionResponse>(`/api/summaries/${encodeURIComponent(passageId)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

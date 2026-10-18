/**
 * Every call to API.Bible goes through here, in one Durable Object (index.ts), so that:
 * - a chapter is fetched once however many readers open it together (one fetch in flight per key);
 * - each call is counted against the plan month before it is made, and refused past the caps
 *   (budget.ts), so the Starter plan's 5,000 calls hold at any number of readers;
 * - a fetched chapter is kept in R2 as one shared copy (John, 18 Oct 2026), Bible text only, never
 *   anything about a reader, and served only until 30 days after API.Bible sent it (§11).
 *
 * Search results are not stored (John's ruling, 12 Oct 2026, kept 18 Oct). Only the Bible's
 * copyright line is, so a search costs one call, not two.
 *
 * Pure: storage, counts, fetch and clock come in through `deps`.
 */

import { expiresAt, mayCall, planMonthStart, type CallKind, type Counts } from "./budget";
import { BIBLES, type LicensedCode } from "./translations";

export interface Stored {
  /** Verbatim `content-type=text` content (§4.1); empty for a Bible's copyright record. */
  readonly content: string;
  /** Verbatim copyright notice (§7). */
  readonly copyright: string;
  /** When API.Bible sent it; the app counts its own 30 days from here, not from its download. */
  readonly fetchedAt: string;
}

export interface ChapterStore {
  get(key: string): Promise<Stored | null>;
  put(key: string, value: Stored): Promise<void>;
}

export interface CountStore {
  /** Reads, checks and adds in one step; false when the call may not be made. */
  reserve(month: string, kind: CallKind, allow: (counts: Counts) => boolean): Promise<boolean>;
}

export interface GateDeps {
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly store: ChapterStore;
  readonly counts: CountStore;
  readonly now: () => Date;
  readonly key: string;
  readonly base: string;
  /** Day of the month the plan took effect, for counting calls per plan month. */
  readonly planDay: number;
}

export type GateResult<T> =
  | { readonly ok: true; readonly body: T }
  | { readonly ok: false; readonly status: number; readonly error: string };

export interface SearchVerse {
  readonly id: string;
  readonly reference: string;
  readonly text: string;
}

export interface SearchFound {
  readonly total: number;
  readonly verses: readonly SearchVerse[];
  readonly copyright: string;
}

export const SEARCH_LIMIT = 20;

export const chapterKey = (code: LicensedCode, chapterId: string) => `ch/${code}/${chapterId}.json`;
export const bibleKey = (code: LicensedCode) => `bible/${code}.json`;

/** The version a stored key belongs to: "ch/NKJV/JHN.3.json" and "bible/NKJV.json" are both NKJV. */
export function codeOfKey(key: string): string {
  const [kind, rest = ""] = key.split("/");
  return kind === "bible" ? rest.replace(/\.json$/, "") : rest;
}

export function isFresh(stored: Stored, now: Date): boolean {
  const fetched = new Date(stored.fetchedAt);
  return !Number.isNaN(fetched.getTime()) && now.getTime() < expiresAt(fetched).getTime();
}

export class Gate {
  private readonly inflight = new Map<string, Promise<GateResult<unknown>>>();

  constructor(private readonly deps: GateDeps) {}

  chapter(code: LicensedCode, chapterId: string): Promise<GateResult<Stored>> {
    const key = chapterKey(code, chapterId);
    return this.once(key, async () => {
      // Another reader's request may have filled it while this one waited.
      const stored = await this.deps.store.get(key);
      if (stored !== null && isFresh(stored, this.deps.now())) return { ok: true, body: stored };
      if (!(await this.reserve("read"))) return { ok: false, status: 503, error: "budget" };

      const res = await this.upstream(upstreamUrl(this.deps.base, BIBLES[code], chapterId));
      if (!res.ok) return res;
      const data = (res.body as { data?: unknown } | null)?.data;
      const { content, copyright } = (typeof data === "object" && data !== null ? data : {}) as { content?: unknown; copyright?: unknown };
      if (typeof content !== "string" || typeof copyright !== "string") return { ok: false, status: 502, error: "upstream" };
      const fresh: Stored = { content, copyright, fetchedAt: this.deps.now().toISOString() };
      await this.deps.store.put(key, fresh);
      return { ok: true, body: fresh };
    });
  }

  search(code: LicensedCode, query: string): Promise<GateResult<SearchFound>> {
    return this.once(`q/${code}/${query.toLowerCase()}`, async () => {
      const copyright = await this.copyright(code);
      if (!copyright.ok) return copyright;
      if (!(await this.reserve("search"))) return { ok: false, status: 503, error: "budget" };
      const res = await this.upstream(searchUrl(this.deps.base, BIBLES[code], query));
      if (!res.ok) return res;
      const data = (res.body as { data?: { total?: unknown; verses?: unknown } } | null)?.data;
      if (data === undefined || data === null) return { ok: false, status: 502, error: "upstream" };
      const verses = (Array.isArray(data.verses) ? data.verses : []).flatMap((v: unknown) => {
        const { id, reference, text } = (v ?? {}) as { id?: unknown; reference?: unknown; text?: unknown };
        return typeof id === "string" && typeof reference === "string" && typeof text === "string" ? [{ id, reference, text }] : [];
      });
      return { ok: true, body: { total: typeof data.total === "number" ? data.total : verses.length, verses, copyright: copyright.body } };
    });
  }

  /** The Bible's notice, kept like a chapter; a read call when it has to be fetched. */
  private copyright(code: LicensedCode): Promise<GateResult<string>> {
    return this.once(bibleKey(code), async () => {
      const stored = await this.deps.store.get(bibleKey(code));
      if (stored !== null && isFresh(stored, this.deps.now())) return { ok: true, body: stored.copyright };
      if (!(await this.reserve("read"))) return { ok: false, status: 503, error: "budget" };
      const res = await this.upstream(`${this.deps.base}/v1/bibles/${encodeURIComponent(BIBLES[code])}`);
      if (!res.ok) return res;
      const copyright = (res.body as { data?: { copyright?: unknown } } | null)?.data?.copyright;
      if (typeof copyright !== "string") return { ok: false, status: 502, error: "upstream" };
      await this.deps.store.put(bibleKey(code), { content: "", copyright, fetchedAt: this.deps.now().toISOString() });
      return { ok: true, body: copyright };
    });
  }

  private reserve(kind: CallKind): Promise<boolean> {
    const month = planMonthStart(this.deps.now(), this.deps.planDay).toISOString().slice(0, 10);
    return this.deps.counts.reserve(month, kind, (counts) => mayCall(kind, counts));
  }

  /** One request per key in flight; later callers share its result. */
  private once<T>(key: string, run: () => Promise<GateResult<T>>): Promise<GateResult<T>> {
    const running = this.inflight.get(key) as Promise<GateResult<T>> | undefined;
    if (running !== undefined) return running;
    const started = run().finally(() => this.inflight.delete(key));
    this.inflight.set(key, started);
    return started;
  }

  /** Upstream bodies are never forwarded on failure: only a status the app can act on. */
  private async upstream(url: string): Promise<GateResult<unknown>> {
    let res: Response;
    try {
      res = await this.deps.fetch(url, { headers: { "api-key": this.deps.key, Accept: "application/json" }, cache: "no-store" });
    } catch {
      return { ok: false, status: 502, error: "upstream" };
    }
    if (res.status === 404) return { ok: false, status: 404, error: "no-chapter" };
    if (res.status === 429) return { ok: false, status: 503, error: "busy" };
    if (!res.ok) return { ok: false, status: 502, error: "upstream" };
    try {
      return { ok: true, body: await res.json() };
    } catch {
      return { ok: false, status: 502, error: "upstream" };
    }
  }
}

/** The same request the app's dev path makes (apps/mobile/src/data/licensed.ts chapterUrl). */
export function upstreamUrl(base: string, bibleId: string, chapterId: string): string {
  return (
    `${base}/v1/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}` +
    "?content-type=text&include-notes=false&include-titles=false&include-verse-numbers=true"
  );
}

function searchUrl(base: string, bibleId: string, query: string): string {
  return `${base}/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}&sort=canonical`;
}

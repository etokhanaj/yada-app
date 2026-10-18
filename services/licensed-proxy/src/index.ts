import { DurableObject } from "cloudflare:workers";

import { parsePlanDay, type CallKind, type Counts } from "./budget";
import { codeOfKey, Gate, isFresh, type ChapterStore, type CountStore, type GateResult, type SearchFound, type Stored } from "./gate";
import { handle, type Env as ProxyEnv } from "./proxy";
import { servedSet, type LicensedCode } from "./translations";

interface Env extends ProxyEnv {
  /** Private bucket (never public: a public copy would "mirror" the API, §8(e)). */
  readonly CACHE: R2Bucket;
  readonly GATE: DurableObjectNamespace<GateObject>;
}

function r2Store(bucket: R2Bucket): ChapterStore {
  return {
    async get(key) {
      const object = await bucket.get(key);
      return object === null ? null : ((await object.json()) as Stored);
    },
    async put(key, value) {
      // fetchedAt is repeated as metadata so the daily prune can judge age from a listing alone.
      await bucket.put(key, JSON.stringify(value), { customMetadata: { fetchedAt: value.fetchedAt } });
    },
  };
}

/**
 * The one place API.Bible is called from (gate.ts). A single instance, so its in-flight map really is
 * one fetch per chapter, and its counts are exact. It stores two numbers per plan month, nothing else.
 */
export class GateObject extends DurableObject<Env> {
  private readonly gate: Gate;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const counts: CountStore = {
      // No await between the get and the put but storage's own, so the input gate keeps it atomic.
      async reserve(month: string, kind: CallKind, allow: (c: Counts) => boolean) {
        const key = `calls:${month}`;
        const now = (await ctx.storage.get<Counts>(key)) ?? { total: 0, search: 0 };
        if (!allow(now)) return false;
        await ctx.storage.put(key, { total: now.total + 1, search: now.search + (kind === "search" ? 1 : 0) });
        return true;
      },
    };
    this.gate = new Gate({
      fetch: (url, init) => fetch(url, init),
      store: r2Store(env.CACHE),
      counts,
      now: () => new Date(),
      key: env.API_BIBLE_KEY ?? "",
      base: (env.API_BIBLE_URL ?? "").replace(/\/+$/, ""),
      planDay: parsePlanDay(env.PLAN_MONTH_DAY),
    });
  }

  chapter(code: LicensedCode, chapterId: string): Promise<GateResult<Stored>> {
    return this.gate.chapter(code, chapterId);
  }

  search(code: LicensedCode, query: string): Promise<GateResult<SearchFound>> {
    return this.gate.search(code, query);
  }
}

/**
 * Daily: delete every copy past its time (§11) and every copy of a version no longer served (§10,
 * §18.8: content goes within 72 hours of termination, 24 hours of a request; SERVED = "" and a deploy
 * stops serving at once, and this removes the copies by the next morning).
 */
async function prune(env: Env, now: Date): Promise<void> {
  const served = servedSet(env.SERVED);
  let cursor: string | undefined;
  do {
    const page = await env.CACHE.list({ include: ["customMetadata"], ...(cursor === undefined ? {} : { cursor }) });
    const gone = page.objects
      .filter((o) => {
        const fetchedAt = o.customMetadata?.fetchedAt ?? "";
        return !served.some((code) => code === codeOfKey(o.key)) || !isFresh({ content: "", copyright: "", fetchedAt }, now);
      })
      .map((o) => o.key);
    if (gone.length > 0) await env.CACHE.delete(gone);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor !== undefined);
}

export default {
  fetch(request, env) {
    const gate = env.GATE.get(env.GATE.idFromName("gate"));
    return handle(request, env, { gate, store: r2Store(env.CACHE), now: () => new Date() });
  },
  async scheduled(_controller, env) {
    await prune(env, new Date());
  },
} satisfies ExportedHandler<Env>;

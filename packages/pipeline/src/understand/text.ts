/**
 * Small text tools shared by the verse assembler and the passage summaries, ported from the two
 * reference prototypes (packages/pipeline/prototypes/assemble.py and passage_summary.py). Python's
 * semantics are kept where they differ from JavaScript's (`str.split()`, `str.strip(chars)`,
 * `difflib.SequenceMatcher`, `random.Random(seed).sample`), because the prototypes' output is what
 * John read and approved (docs/no-ai-understand.md, 12 Oct 2026).
 */

import { createHash } from "node:crypto";

/** Python's `str.split()` with no argument: whitespace runs, no empty items. */
export function pySplit(text: string): string[] {
  return text.split(/\s+/).filter((w) => w !== "");
}

/** Python's `str.strip(chars)`, `lstrip` and `rstrip`. */
export function stripChars(text: string, chars: string): string {
  return rstripChars(lstripChars(text, chars), chars);
}

export function lstripChars(text: string, chars: string): string {
  let i = 0;
  while (i < text.length && chars.includes(text[i] ?? "")) i += 1;
  return text.slice(i);
}

export function rstripChars(text: string, chars: string): string {
  let i = text.length;
  while (i > 0 && chars.includes(text[i - 1] ?? "")) i -= 1;
  return text.slice(0, i);
}

/** Python's `str.splitlines()`: every line boundary it knows, not only "\n". */
export function splitLines(text: string): string[] {
  const lines = text.split(new RegExp("\\r\\n|[\\n\\r\\v\\f\\x1c-\\x1e\\x85\\u2028\\u2029]"));
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Order-keeping de-duplication, Python's `list(dict.fromkeys(xs))`. */
export function unique<T>(items: Iterable<T>): T[] {
  return [...new Set(items)];
}

/** The first item with the highest key, as Python's `max(xs, key=...)` picks it. Keys compare as tuples. */
export function argmax<T>(items: readonly T[], key: (item: T) => number | readonly number[]): T | undefined {
  let best: T | undefined;
  let bestKey: readonly number[] = [];
  for (const item of items) {
    const raw = key(item);
    const k = typeof raw === "number" ? [raw] : raw;
    if (best === undefined || compareTuples(k, bestKey) > 0) {
      best = item;
      bestKey = k;
    }
  }
  return best;
}

export function compareTuples(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

/** Fills a fixed template's `{name}` slots once; a value is never re-read as a template (Python's `str.format`). */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`template slot {${name}} has no value`);
    return String(value);
  });
}

// ---------------------------------------------------------------------------
// difflib.SequenceMatcher(autojunk=False).get_opcodes(), for the translation-difference fact
// ---------------------------------------------------------------------------

export type Opcode = ["replace" | "delete" | "insert" | "equal", number, number, number, number];

/**
 * CPython's algorithm, line for line (Lib/difflib.py, no junk, no popularity pruning). The fact
 * "Translations differ" is only as stable as the alignment, so a different diff would show John
 * different facts from the ones he read in the prototype's report.
 */
export function opcodes(a: readonly string[], b: readonly string[]): Opcode[] {
  const b2j = new Map<string, number[]>();
  b.forEach((elt, i) => {
    const list = b2j.get(elt);
    if (list === undefined) b2j.set(elt, [i]);
    else list.push(i);
  });

  const longest = (alo: number, ahi: number, blo: number, bhi: number): [number, number, number] => {
    let besti = alo;
    let bestj = blo;
    let bestsize = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i += 1) {
      const next = new Map<number, number>();
      for (const j of b2j.get(a[i] ?? "") ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        next.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
      j2len = next;
    }
    // With no junk these extensions only matter at the edges; kept so the result is CPython's.
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti -= 1;
      bestj -= 1;
      bestsize += 1;
    }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) bestsize += 1;
    return [besti, bestj, bestsize];
  };

  const queue: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]];
  const blocks: Array<[number, number, number]> = [];
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
    const [i, j, k] = longest(alo, ahi, blo, bhi);
    if (k > 0) {
      blocks.push([i, j, k]);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  blocks.sort((x, y) => compareTuples(x, y));
  const merged: Array<[number, number, number]> = [];
  let [i1, j1, k1] = [0, 0, 0];
  for (const [i2, j2, k2] of blocks) {
    if (i1 + k1 === i2 && j1 + k1 === j2) k1 += k2;
    else {
      if (k1 > 0) merged.push([i1, j1, k1]);
      [i1, j1, k1] = [i2, j2, k2];
    }
  }
  if (k1 > 0) merged.push([i1, j1, k1]);
  merged.push([a.length, b.length, 0]);

  const out: Opcode[] = [];
  let i = 0;
  let j = 0;
  for (const [ai, bj, size] of merged) {
    const tag = i < ai && j < bj ? "replace" : i < ai ? "delete" : j < bj ? "insert" : null;
    if (tag !== null) out.push([tag, i, ai, j, bj]);
    i = ai + size;
    j = bj + size;
    if (size > 0) out.push(["equal", ai, i, bj, j]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The seeded sample: CPython 3.9's random.Random(str).sample, so the 5 passages John reads once per
// book are the ones the prototype printed (docs/no-ai-understand.md lists them for John and 1 Corinthians).
// ---------------------------------------------------------------------------

class MersenneTwister {
  private readonly mt = new Uint32Array(624);
  private index = 624;

  constructor(key: readonly number[]) {
    const mt = this.mt;
    mt[0] = 19650218;
    for (let i = 1; i < 624; i += 1) {
      const prev = mt[i - 1] as number;
      mt[i] = (Math.imul(1812433253, prev ^ (prev >>> 30)) + i) >>> 0;
    }
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k -= 1) {
      const prev = mt[i - 1] as number;
      mt[i] = (((mt[i] as number) ^ Math.imul(prev ^ (prev >>> 30), 1664525)) + (key[j] as number) + j) >>> 0;
      i += 1;
      j += 1;
      if (i >= 624) {
        mt[0] = mt[623] as number;
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k -= 1) {
      const prev = mt[i - 1] as number;
      mt[i] = (((mt[i] as number) ^ Math.imul(prev ^ (prev >>> 30), 1566083941)) - i) >>> 0;
      i += 1;
      if (i >= 624) {
        mt[0] = mt[623] as number;
        i = 1;
      }
    }
    mt[0] = 0x80000000;
  }

  uint32(): number {
    const mt = this.mt;
    if (this.index >= 624) {
      for (let kk = 0; kk < 624; kk += 1) {
        const y = ((mt[kk] as number) & 0x80000000) | ((mt[(kk + 1) % 624] as number) & 0x7fffffff);
        mt[kk] = ((mt[(kk + 397) % 624] as number) ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0)) >>> 0;
      }
      this.index = 0;
    }
    let y = mt[this.index] as number;
    this.index += 1;
    y ^= y >>> 11;
    y = (y ^ ((y << 7) & 0x9d2c5680)) >>> 0;
    y = (y ^ ((y << 15) & 0xefc60000)) >>> 0;
    return (y ^ (y >>> 18)) >>> 0;
  }

  /** `_randbelow_with_getrandbits`, for n below 2**32. */
  below(n: number): number {
    const bits = n.toString(2).length;
    for (;;) {
      const r = this.uint32() >>> (32 - bits);
      if (r < n) return r;
    }
  }
}

/** `random.Random(seed)` for a str seed (version 2): the bytes plus their SHA-512, as one big-endian integer. */
function seedKey(seed: string): number[] {
  const bytes = Buffer.from(seed, "utf8");
  const all = Buffer.concat([bytes, createHash("sha512").update(bytes).digest()]);
  let n = BigInt(`0x${all.toString("hex")}`);
  const key: number[] = [];
  while (n > 0n) {
    key.push(Number(n & 0xffffffffn));
    n >>= 32n;
  }
  return key.length > 0 ? key : [0];
}

/** `random.Random(seed).sample(population, k)` as CPython 3.9 draws it. */
export function seededSample<T>(seed: string, population: readonly T[], k: number): T[] {
  const rng = new MersenneTwister(seedKey(seed));
  const n = population.length;
  let setsize = 21;
  if (k > 5) setsize += 4 ** Math.ceil(Math.log(k * 3) / Math.log(4));
  const result: T[] = [];
  if (n <= setsize) {
    const pool = [...population];
    for (let i = 0; i < k; i += 1) {
      const j = rng.below(n - i);
      result.push(pool[j] as T);
      pool[j] = pool[n - i - 1] as T;
    }
  } else {
    const selected = new Set<number>();
    for (let i = 0; i < k; i += 1) {
      let j = rng.below(n);
      while (selected.has(j)) j = rng.below(n);
      selected.add(j);
      result.push(population[j] as T);
    }
  }
  return result;
}

/**
 * Readers for the two CrossWire SWORD module formats Yada takes public-domain reference works from:
 * zCom (a verse-keyed commentary: Matthew Henry's Concise) and zLD (a keyed dictionary: Easton's).
 * The modules are read as data, byte for byte; nothing in them is run. The CrossWire copies are used
 * rather than CCEL's ThML because their own .conf files say "DistributionLicense=Public Domain" with
 * no host terms, where CCEL's files carry "Copyright Christian Classics Ethereal Library" (rule 3,
 * 15 Oct 2026).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

import { UnderstandRefused, parsePins, readIfExists } from "./sources.js";

/**
 * A file under content/raw, read only once its sha256 matches the pin in `pinsFile` ("sha256  path"
 * lines, as matthew-henry.sha256 and easton.sha256 pin each download). Refuses a missing or changed file.
 */
export function pinnedFile(raw: string, pinsFile: string, rel: string, verify = true): Buffer {
  const bytes = readFileSync(path.join(raw, rel));
  if (verify) {
    const pin = parsePins(readIfExists(path.join(raw, pinsFile)) ?? "").get(rel);
    if (pin === undefined) throw new UnderstandRefused(`${rel} has no pin in ${pinsFile}`);
    if (createHash("sha256").update(bytes).digest("hex") !== pin) throw new UnderstandRefused(`${rel} does not match its pin`);
  }
  return bytes;
}

const u32 = (b: Buffer, at: number): number => b.readUInt32LE(at);

/**
 * A zCom testament's entries in canonical order. The verse index (.bzv) holds block, offset and a
 * 16-bit size per verse; a section's text is linked to every verse it covers, so a run of verses
 * pointing at the same text yields it once. Blocks (.bzs: offset, size, raw size) are zlib streams.
 */
export function zComEntries(bzs: Buffer, bzv: Buffer, bzz: Buffer): string[] {
  const blocks = new Map<number, Buffer>();
  const block = (n: number): Buffer => {
    let b = blocks.get(n);
    if (b === undefined) {
      b = inflateSync(bzz.subarray(u32(bzs, n * 12), u32(bzs, n * 12) + u32(bzs, n * 12 + 4)));
      blocks.set(n, b);
    }
    return b;
  };
  const out: string[] = [];
  let prev = "";
  for (let at = 0; at + 10 <= bzv.length; at += 10) {
    const size = bzv.readUInt16LE(at + 8);
    if (size === 0) continue;
    const key = `${u32(bzv, at)}:${u32(bzv, at + 4)}`;
    if (key === prev) continue;
    prev = key;
    const offset = u32(bzv, at + 4);
    out.push(block(u32(bzv, at)).subarray(offset, offset + size).toString("utf8"));
  }
  return out;
}

export interface LdEntry {
  key: string;
  text: string;
}

/**
 * A zLD dictionary's entries in key order. The .idx gives each key's record in .dat ("KEY\r\n" then
 * block and entry numbers); .zdx locates each zlib block in .zdt; a block starts with its entry count
 * and an (offset, size) pair per entry.
 */
export function zLdEntries(idx: Buffer, dat: Buffer, zdx: Buffer, zdt: Buffer): LdEntry[] {
  const blocks = new Map<number, Buffer>();
  const out: LdEntry[] = [];
  for (let at = 0; at + 8 <= idx.length; at += 8) {
    const rec = dat.subarray(u32(idx, at), u32(idx, at) + u32(idx, at + 4));
    const nl = rec.indexOf(0x0a);
    const key = rec.subarray(0, nl).toString("utf8").replace(/\r$/, "");
    const n = u32(rec, nl + 1);
    const entry = u32(rec, nl + 5);
    let b = blocks.get(n);
    if (b === undefined) {
      b = inflateSync(zdt.subarray(u32(zdx, n * 8), u32(zdx, n * 8) + u32(zdx, n * 8 + 4)));
      blocks.set(n, b);
    }
    const offset = u32(b, 4 + entry * 8);
    out.push({ key, text: b.subarray(offset, offset + u32(b, 8 + entry * 8)).toString("utf8").replace(/\0+$/, "") });
  }
  return out;
}

/** `&amp;` and its kin to characters; the modules hold no other entities (checked 15 Oct 2026). */
export function decodeEntities(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

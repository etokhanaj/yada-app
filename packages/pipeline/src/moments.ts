/**
 * Verses for a moment (Build 11h; frames VM-01 to VM-04, VM-08 to VM-11): candidate references for each moment from
 * OpenBible.info's topic scores (topic-scores.zip, generated 2026-10-12, header "CC-BY License:
 * www.openbible.info/topics", licence read from the file itself, rule 3). The file holds references and a vote-based
 * score only, no verse text; the words shown are the BSB's, joined from core in the app. The six moments and their
 * topics are John's decision of 18 Oct 2026 (`moments-topics.md` (in the private repo)). Nothing here ships: `--write` writes
 * drafts for John's review queue, and the score only picks candidates. The app shows no score, rank or "most chosen"
 * (John, 18 Oct 2026: no voting and no ranking); the order a reader sees is the order John approves.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { osisRange } from "./study.js";

export const MOMENTS_FILES: Readonly<Record<string, string>> = {
  "openbible-topics/topic-scores.zip": "9bf6a3c1418414b29776eb8db29eb36954130986854ce2ef2aa45449e2c4353b",
  "openbible-topics/topic-scores.txt": "07336057f2592a4c3153e335cef240403726315952638ee6604a0f658218b7fb",
};

const LICENCE = "CC-BY License: www.openbible.info/topics";

/** John's six (18 Oct 2026), each with the topic it reads from. */
export const MOMENTS: readonly { readonly moment: string; readonly topic: string }[] = [
  { moment: "Anxious", topic: "worry" },
  { moment: "Afraid", topic: "fear" },
  { moment: "Grieving", topic: "grief" },
  { moment: "Lonely", topic: "loneliness" },
  { moment: "Tired", topic: "tired" },
  { moment: "Thankful", topic: "thankful" },
];

/** At most this many candidates per moment go to John; he keeps between five and eight. */
export const CANDIDATES = 8;

export class MomentsRefused extends Error {}

export interface TopicRef {
  readonly osis: string;
  readonly start: number;
  readonly end: number;
  readonly score: number;
}

export function parseTopicScores(text: string): Map<string, TopicRef[]> {
  const [header = "", ...lines] = text.split(/\r?\n/);
  if (!header.startsWith("Topic\tOSIS\t") || !header.includes(LICENCE)) throw new MomentsRefused("topic-scores.txt has lost its header or its CC-BY line");
  const out = new Map<string, TopicRef[]>();
  for (const line of lines) {
    if (line.trim() === "") continue;
    const [topic = "", osis = "", score = ""] = line.split("\t");
    if (!/^-?\d+$/.test(score)) throw new MomentsRefused(`unreadable score in: ${line}`);
    const { start, end } = osisRange(osis);
    out.set(topic, [...(out.get(topic) ?? []), { osis, start, end, score: Number(score) }]);
  }
  for (const refs of out.values()) refs.sort((a, b) => b.score - a.score || a.start - b.start);
  return out;
}

/** The best-scored references, skipping any inside one already taken, so no verse is offered twice. */
export function candidates(refs: readonly TopicRef[], n = CANDIDATES): TopicRef[] {
  const out: TopicRef[] = [];
  for (const r of refs) {
    if (r.score <= 0) continue;
    if (out.some((q) => r.start <= q.end && q.start <= r.end)) continue;
    out.push(r);
    if (out.length === n) break;
  }
  return out;
}

function readPinned(raw: string, file: string): string {
  const full = path.join(raw, file);
  if (!existsSync(full)) throw new MomentsRefused(`${full} is missing`);
  const bytes = readFileSync(full);
  if (createHash("sha256").update(bytes).digest("hex") !== MOMENTS_FILES[file]) throw new MomentsRefused(`${full} does not match its pin`);
  return bytes.toString("utf8");
}

/** `yada moments [--write]`: each moment's candidates; --write puts them in the review file as drafts. */
export function momentsCommand(args: readonly string[], options: { raw: string; reviewFile: string }): number {
  let topics: Map<string, TopicRef[]>;
  try {
    readPinned(options.raw, "openbible-topics/topic-scores.zip");
    topics = parseTopicScores(readPinned(options.raw, "openbible-topics/topic-scores.txt"));
  } catch (error) {
    if (error instanceof MomentsRefused) {
      console.error(`moments: REFUSED. ${error.message}`);
      return 1;
    }
    throw error;
  }
  const drafts = MOMENTS.map(({ moment, topic }) => {
    const refs = topics.get(topic);
    if (refs === undefined) throw new MomentsRefused(`no topic "${topic}" for ${moment}`);
    return { moment, topic, status: "draft", candidates: candidates(refs).map((r) => ({ osis: r.osis, ord_start: r.start, ord_end: r.end })) };
  });
  for (const d of drafts) console.log(`moments: ${d.moment} (${d.topic}): ${d.candidates.map((c) => c.osis).join(", ")}`);
  if (args.includes("--write")) {
    // John approved all six on 22 Oct 2026; writing drafts over the file would erase his decisions (rule 2).
    if (existsSync(options.reviewFile) && hasApproved(readFileSync(options.reviewFile, "utf8"))) {
      console.error(`moments: REFUSED. ${options.reviewFile} holds John's approvals; drafts would overwrite them`);
      return 1;
    }
    writeFileSync(
      options.reviewFile,
      `${JSON.stringify({ source: "OpenBible.info topic scores, CC BY 4.0", generated: "2026-10-12", moments: drafts }, null, 2)}\n`,
      "utf8",
    );
    console.log(`wrote ${options.reviewFile} (drafts; nothing ships until John approves each reference)`);
  }
  return 0;
}

/** Whether a review file holds any moment John has approved. */
export function hasApproved(text: string): boolean {
  const parsed = JSON.parse(text) as { moments?: readonly { status?: string }[] };
  return (parsed.moments ?? []).some((m) => m.status === "approved");
}

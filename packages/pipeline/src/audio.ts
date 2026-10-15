/**
 * `yada audio <BOOK> [--narrator=hays]`: a BSB reading, chapter by chapter, for read-along
 * (build plan Phase 4; docs/plan-additions-2026-10-12.md §D; docs/research/bsb-audio-printing-check.md).
 *
 * Two kinds of reading, one path after the sound exists:
 * - a human narrator's MP3 in content/raw/audio/<narrator>/ (Berean Bible audio, CC0, pinned by sha256);
 * - a computer voice (Kokoro-82M, Apache-2.0; John chose Heart and George, 12 Oct 2026), made here on the
 *   Mac verse by verse from core's text, never on the phone.
 * Then, per chapter:
 * - mono AAC at 48 kbps, the file the phone plays;
 * - timings: when each verse and each of its words starts, by aligning the recording's words with the BSB
 *   text (core). The speech recogniser (whisper.cpp, offline) supplies times only: its words are compared
 *   with ours and discarded, never shown and never stored as text (§D "No-AI rule").
 *
 * The no-AI rule is about text: every word heard is the translation's own, and a computer voice is named
 * as one wherever it is chosen. Only Hays is built among the humans: Souer and Gilbert read an earlier
 * printing (the printing check). Nothing is published: R2 is John's step.
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { type AudioTitles, BOOK_CODES, BOOK_ORDER, type BookCode, numberWords, spokenTitle, verseOrd } from "@yada/schema";
// Types only: the model loads in loadKokoro, so a Hays build never starts onnxruntime.
import type { KokoroTTS } from "kokoro-js";

import { highestVersionOnDisk, sha256File } from "./package.js";
import { readPruned } from "./publish.js";
import { understandPaths } from "./understand/package.js";

export const HUMAN_NARRATORS = {
  hays: { name: "Barry Hays", suffix: "_H" },
  souer: { name: "Bob Souer", suffix: "" },
  gilbert: { name: "Jordan Scott Gilbert", suffix: "_G" },
} as const;

/** Kokoro voices, by the id the model knows them by, with the sha256 of each voice file (kokoro-js 1.2.1). */
export const COMPUTER_VOICES = {
  heart: { name: "Heart", voice: "af_heart", sha256: "d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b" },
  george: { name: "George", voice: "bm_george", sha256: "c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc" },
} as const;

export const NARRATORS = { ...HUMAN_NARRATORS, ...COMPUTER_VOICES };

/** Each reading's licence, as its source states it (sources.manifest.json has where each was read). */
export function creditOf(n: Narrator): { credit: string; credit_url: string } {
  return isComputer(n)
    ? { credit: "Made with Kokoro-82M (hexgrad), Apache License 2.0. The words are the BSB’s.", credit_url: "https://huggingface.co/hexgrad/Kokoro-82M" }
    : { credit: `Narrated by ${NARRATORS[n].name}. Dedicated to the public domain (CC0 1.0).`, credit_url: "https://bereanbible.com/audio/" };
}
export type Narrator = keyof typeof NARRATORS;
export type ComputerVoice = keyof typeof COMPUTER_VOICES;

const isComputer = (n: Narrator): n is ComputerVoice => Object.hasOwn(COMPUTER_VOICES, n);
export const narratorKind = (n: Narrator): "human" | "computer" => (isComputer(n) ? "computer" : "human");

/** Kokoro-82M v1.0, the onnx-community export, quantised (q8): the file the comparison used, by its digest. */
export const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const KOKORO_MODEL_SHA256 = "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478";

/**
 * The texts a reading may be made from: the public-domain four. Licensed versions (NKJV, NLT, MSG, NIV
 * and any later) never enter the content pipeline or any generated output (CLAUDE.md rule 9; API.Bible
 * §9.1), so a request for one is refused here, before anything is read.
 */
export const AUDIO_TEXTS = ["BSB", "WEB", "KJV", "LSV"] as const;
export type AudioText = (typeof AUDIO_TEXTS)[number];

export class AudioRefused extends Error {}

/** Where a voice's reading lives beside the manifest: the BSB at audio/heart/, the others a folder below. */
export const readingDir = (narrator: string, text: AudioText): string => (text === "BSB" ? `audio/${narrator}` : `audio/${narrator}/${text.toLowerCase()}`);

export function audioText(translation: string): AudioText {
  const found = AUDIO_TEXTS.find((t) => t === translation);
  if (found === undefined) throw new AudioRefused(`${translation} is not one of ${AUDIO_TEXTS.join(", ")}: licensed text never becomes audio (rule 9)`);
  return found;
}

export interface Heard {
  readonly word: string;
  /** Seconds from the start of the file. */
  readonly at: number;
}

export interface VerseTiming {
  readonly verse: number;
  readonly start: number;
  readonly end: number;
  /** When each whitespace-separated word of the verse's BSB text starts, in seconds. */
  readonly words: number[];
}

export interface ChapterTimings {
  readonly format: 1;
  readonly book: BookCode;
  readonly chapter: number;
  readonly narrator: Narrator;
  readonly duration: number;
  readonly verses: VerseTiming[];
  /** Share of the text's words the recording was heard to say: a printing check on every chapter. */
  readonly matched: number;
  /** A computer voice's verses with a part made too fast for its length: Kokoro dropped its tail. */
  readonly cutShort?: number[];
}

// A closing single quote is punctuation, not part of the word: "me.’”" is "me" (John 1:15, 12 Oct 2026).
const fold = (w: string): string =>
  w
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");

/**
 * Times for the text's words from the words heard, by longest common subsequence on folded words. A word
 * the recogniser missed takes the time of the word before it, so a verse never starts before its first word
 * and times never run backwards.
 */
export function alignWords(text: readonly string[], heard: readonly Heard[]): { times: number[]; matched: number; heardAt: boolean[] } {
  const a = text.map(fold);
  const b = heard.map((h) => fold(h.word));
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = lcs[i] as Uint32Array;
    const below = lcs[i + 1] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) row[j] = a[i] !== "" && a[i] === b[j] ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
  }
  const times = new Array<number>(n).fill(Number.NaN);
  let i = 0;
  let j = 0;
  let matched = 0;
  while (i < n && j < m) {
    if (a[i] !== "" && a[i] === b[j]) {
      times[i] = (heard[j] as Heard).at;
      matched++;
      i++;
      j++;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) i++;
    else j++;
  }
  const heardAt = times.map((t) => !Number.isNaN(t));
  let last = 0;
  for (let k = 0; k < n; k++) {
    if (Number.isNaN(times[k])) times[k] = last;
    else last = times[k] as number;
  }
  return { times, matched: n === 0 ? 1 : matched / n, heardAt };
}

/** The chapter's verses and their words, cut back into per-verse timings. */
export function chapterTimings(
  book: BookCode,
  chapter: number,
  narrator: Narrator,
  verses: ReadonlyArray<{ verse: number; text: string }>,
  heard: readonly Heard[],
  duration: number,
  spoken?: readonly SpokenPart[],
): ChapterTimings {
  const split = verses.map((v) => v.text.split(/\s+/).filter((w) => w !== ""));
  const { times, matched, heardAt } = alignWords(split.flat(), heard);
  const out: VerseTiming[] = [];
  let k = 0;
  split.forEach((words, index) => {
    // A verse the BSB leaves blank (Matthew 17:21 and 15 others) is not read and has no timing: given a
    // start of 0 it ended the verse before it at once (the all-books check, 13 Oct 2026).
    if (words.length === 0) return;
    const verse = (verses[index] as { verse: number }).verse;
    const own = times.slice(k, k + words.length);
    const parts = spoken?.filter((p) => p.verse === verse) ?? [];
    if (parts.length > 0) {
      // A computer voice: the verse runs exactly where its parts were made, and a word the recogniser
      // missed (a name) sits between its heard neighbours by its place in the text.
      const start = Math.min(...parts.map((p) => p.start));
      const end = Math.max(...parts.map((p) => p.end));
      const offsets = words.map((_, w) => words.slice(0, w).join(" ").length + (w > 0 ? 1 : 0));
      const length = words.join(" ").length;
      const known = words.map((_, w) => (heardAt[k + w] === true && (own[w] as number) >= start && (own[w] as number) <= end ? (own[w] as number) : null));
      const placed = words.map((_, w) => {
        const here = known[w];
        if (here !== null && here !== undefined) return here;
        let before = w - 1;
        while (before >= 0 && known[before] === null) before--;
        let after = w + 1;
        while (after < words.length && known[after] === null) after++;
        const [o0, t0] = before < 0 ? [0, start] : [offsets[before] as number, known[before] as number];
        const [o1, t1] = after >= words.length ? [length, end] : [offsets[after] as number, known[after] as number];
        return o1 === o0 ? t0 : t0 + ((t1 - t0) * ((offsets[w] as number) - o0)) / (o1 - o0);
      });
      for (let w = 1; w < placed.length; w++) placed[w] = Math.max(placed[w] as number, placed[w - 1] as number);
      out.push({ verse, start, end, words: placed });
    } else {
      const start = own[0] ?? 0;
      out.push({ verse, start, end: duration, words: own });
      const previous = out[out.length - 2];
      if (previous !== undefined) out[out.length - 2] = { ...previous, end: start };
    }
    k += words.length;
  });
  const cutShort = [...new Set(cutParts(spoken ?? []).map((p) => p.verse))];
  return { format: 1, book, chapter, narrator, duration, verses: out, matched, ...(cutShort.length > 0 ? { cutShort } : {}) };
}

/** BSB_43_Jhn_001_H.mp3: the Berean file name for a chapter. */
export function sourceFileName(dir: string, book: BookCode, chapter: number, narrator: keyof typeof HUMAN_NARRATORS): string | null {
  // The Berean files number books in canonical order: 01 Genesis … 43 John.
  const number = String(BOOK_ORDER.indexOf(book) + 1).padStart(2, "0");
  const pattern = new RegExp(`^BSB_${number}_\\w+_${String(chapter).padStart(3, "0")}${HUMAN_NARRATORS[narrator].suffix}\\.mp3$`);
  return existsSync(dir) ? (readdirSync(dir).find((f) => pattern.test(f)) ?? null) : null;
}

export interface AudioChapterInfo {
  readonly chapter: number;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly timings: string;
  readonly timings_sha256: string;
  readonly duration: number;
}

export interface AudioReport {
  readonly book: BookCode;
  readonly narrator: Narrator;
  readonly chapters: AudioChapterInfo[];
  readonly missing: number[];
  readonly lowMatch: Array<{ chapter: number; matched: number }>;
}

/** Below this share of the text heard, a human reading is reported: a different printing, or a bad recording. */
export const MATCH_FLOOR = 0.97;
/**
 * A computer voice reads our own text, so a miss is the recogniser's ("Selah", and in 1 Chronicles 1 the
 * names: 75% heard), not another printing. Its check is that no part was cut short (cutParts); the share
 * heard only has to show the file is speech (13 Oct 2026).
 */
export const COMPUTER_FLOOR = 0.6;

export function passes(narrator: Narrator, t: Pick<ChapterTimings, "matched" | "cutShort">): boolean {
  return isComputer(narrator) ? t.matched >= COMPUTER_FLOOR && (t.cutShort ?? []).length === 0 : t.matched >= MATCH_FLOOR;
}

function heardWords(json: string): Heard[] {
  const parsed = JSON.parse(readFileSync(json, "utf8")) as { transcription?: Array<{ text?: string; offsets?: { from?: number } }> };
  return (parsed.transcription ?? []).flatMap((t) =>
    typeof t.text === "string" && t.text.trim() !== "" && typeof t.offsets?.from === "number" ? [{ word: t.text.trim(), at: t.offsets.from / 1000 }] : [],
  );
}

/** Kokoro reads at most ~510 phoneme tokens and silently drops the rest (25 s cut-offs in the comparison). */
const PART_CHARS = 280;

/**
 * A verse in parts short enough for one Kokoro call: sentences, and a long sentence at its commas. The
 * words are the verse's own, in order; the printing check on the result proves nothing was dropped.
 */
export function speakableParts(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;:][”’"']?)\s+/).filter((p) => p.trim() !== "");
  return sentences.flatMap((sentence) => (sentence.length <= PART_CHARS ? [sentence] : packed(sentence.split(/(?<=,)\s+/))));
}

/**
 * Pieces joined up to the limit; a piece still over it (a long run with no comma) is cut between words,
 * so no part is ever long enough for Kokoro to drop its tail (review, 12 Oct 2026).
 */
function packed(pieces: readonly string[]): string[] {
  const parts: string[] = [];
  let current = "";
  const add = (piece: string) => {
    if (current !== "" && current.length + piece.length + 1 > PART_CHARS) {
      parts.push(current);
      current = piece;
    } else current = current === "" ? piece : `${current} ${piece}`;
  };
  for (const piece of pieces) {
    if (piece.length <= PART_CHARS) add(piece);
    else for (const word of piece.split(/\s+/)) add(word);
  }
  if (current !== "") parts.push(current);
  return parts;
}

/** One Kokoro call's place in the chapter it was made into, in seconds. */
export interface SpokenPart {
  readonly verse: number;
  readonly start: number;
  readonly end: number;
  readonly chars: number;
}

/**
 * Kokoro reading a part too fast for its length is a part whose tail it dropped (its 510-token limit):
 * normal speech runs about 0.06 s a character. The check a computer voice must pass, in place of the
 * recogniser's misses, which in 1 Chronicles 1 were the names (75% heard, 13 Oct 2026).
 */
export const MIN_SECONDS_PER_CHAR = 0.035;
export const cutParts = (parts: readonly SpokenPart[]): SpokenPart[] =>
  parts.filter((p) => p.chars >= 40 && (p.end - p.start) / p.chars < MIN_SECONDS_PER_CHAR);

/** Seconds of silence before a verse: between verses, and longer where a passage begins (the reader's pause). */
export const VERSE_GAP = 0.45;
export const PASSAGE_GAP = 0.9;

type Speaker = KokoroTTS;

async function loadKokoro(models: string): Promise<Speaker> {
  const file = path.join(models, KOKORO_MODEL, "onnx", "model_quantized.onnx");
  if (!existsSync(file)) throw new AudioRefused(`${file} is missing: fetch ${KOKORO_MODEL} (q8) into content/raw/kokoro/models first`);
  if (sha256File(file) !== KOKORO_MODEL_SHA256) throw new AudioRefused(`${file} is not the pinned Kokoro model (sha256)`);
  const { env } = await import("@huggingface/transformers");
  // The pinned copy only: nothing is fetched while a book is made.
  env.cacheDir = models;
  env.allowRemoteModels = false;
  const { KokoroTTS } = await import("kokoro-js");
  return KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "cpu" });
}

function checkVoiceFile(voice: ComputerVoice): void {
  // The package exports only its entry (dist/); the voices sit beside dist/, where kokoro-js reads them.
  const file = path.join(path.dirname(createRequire(import.meta.url).resolve("kokoro-js")), "..", "voices", `${COMPUTER_VOICES[voice].voice}.bin`);
  if (sha256File(file) !== COMPUTER_VOICES[voice].sha256) throw new AudioRefused(`${file} is not the pinned ${COMPUTER_VOICES[voice].name} voice (sha256)`);
}

/** 16-bit mono PCM WAV, the form ffmpeg takes in. */
function writeWav(file: string, samples: Float32Array, rate: number): void {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

async function synthesizeChapter(
  speaker: Speaker,
  voice: (typeof COMPUTER_VOICES)[ComputerVoice]["voice"],
  verses: ReadonlyArray<{ verse: number; text: string }>,
  passageStart: (verse: number) => boolean,
  wav: string,
): Promise<SpokenPart[]> {
  const chunks: Float32Array[] = [];
  const spans: SpokenPart[] = [];
  let rate = 24000;
  let samples = 0;
  const push = (c: Float32Array) => {
    chunks.push(c);
    samples += c.length;
  };
  for (const v of verses) {
    if (v.text.trim() === "") continue;
    if (chunks.length > 0) push(new Float32Array(Math.round(rate * (passageStart(v.verse) ? PASSAGE_GAP : VERSE_GAP))));
    for (const part of speakableParts(v.text)) {
      const out = await speaker.generate(part, { voice });
      rate = out.sampling_rate;
      const start = samples / rate;
      push(out.audio);
      spans.push({ verse: v.verse, start, end: samples / rate, chars: part.length });
    }
  }
  const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  writeWav(wav, all, rate);
  return spans;
}

// The words a chapter's name is said in live in @yada/schema, so the iPhone voice in the app says exactly what
// the recorded titles say (build 6, spoken chapter names).
export { numberWords, spokenTitle };

/**
 * `yada audio-titles <BOOK> --narrator=heart`: every chapter's name in a computer voice, one after another
 * in one file, with where each starts and ends. No recogniser check: a title is a few words the pipeline
 * wrote, so a span too short to hold them is the only failure looked for.
 */
export async function buildTitles(book: BookCode, narrator: ComputerVoice, root = process.env["YADA_ROOT"]): Promise<AudioTitles> {
  const paths = understandPaths(root);
  const out = path.join(paths.bundles, "audio", narrator);
  const work = path.join(paths.content, "audio-work", narrator);
  mkdirSync(out, { recursive: true });
  mkdirSync(work, { recursive: true });
  checkVoiceFile(narrator);
  const speaker = await loadKokoro(path.join(paths.raw, "kokoro", "models"));
  const chunks: Float32Array[] = [];
  const spans: AudioTitles["spans"] = [];
  let rate = 24000;
  let samples = 0;
  for (let chapter = 1; chapter <= BOOK_CODES[book].chapters; chapter++) {
    const text = spokenTitle(book, chapter);
    const said = await speaker.generate(text, { voice: COMPUTER_VOICES[narrator].voice });
    rate = said.sampling_rate;
    const start = samples / rate;
    chunks.push(said.audio);
    samples += said.audio.length;
    if (samples / rate - start < 0.04 * text.length) throw new AudioRefused(`${book} ${chapter}: "${text}" came out too short`);
    spans.push({ chapter, start, end: samples / rate });
    // A breath between titles, so a span's end never clips the next title's first sound.
    const gap = new Float32Array(Math.round(rate * 0.3));
    chunks.push(gap);
    samples += gap.length;
  }
  const all = new Float32Array(samples);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  const base = `${book.toLowerCase()}-titles`;
  const wav = path.join(work, `${base}.wav`);
  const m4a = path.join(out, `${base}.m4a`);
  writeWav(wav, all, rate);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-c:a", "aac", "-b:a", "48k", m4a]);
  rmSync(wav, { force: true });
  writeFileSync(path.join(out, `${base}.spans.json`), `${JSON.stringify(spans)}\n`);
  return { file: `audio/${narrator}/${base}.m4a`, sha256: sha256File(m4a), bytes: statSync(m4a).size, spans };
}

/** A book's titles file on disk, if `yada audio-titles` made it. */
function titlesOnDisk(dir: string, narrator: Narrator, book: BookCode): AudioTitles | undefined {
  const base = `${book.toLowerCase()}-titles`;
  const m4a = path.join(dir, `${base}.m4a`);
  const spans = path.join(dir, `${base}.spans.json`);
  if (!existsSync(m4a) || !existsSync(spans)) return undefined;
  return { file: `audio/${narrator}/${base}.m4a`, sha256: sha256File(m4a), bytes: statSync(m4a).size, spans: JSON.parse(readFileSync(spans, "utf8")) as AudioTitles["spans"] };
}

export async function buildAudio(
  book: BookCode,
  narrator: Narrator,
  translation: string = "BSB",
  root = process.env["YADA_ROOT"],
  only: number | null = null,
): Promise<AudioReport> {
  // Refused before anything is read (rule 9). WEB, KJV and LSV in Heart and George only (John, 13 Oct 2026):
  // no human reading of them was chosen.
  const text = audioText(translation);
  if (text !== "BSB" && !isComputer(narrator)) throw new AudioRefused(`${NARRATORS[narrator].name} reads the BSB only`);
  const paths = understandPaths(root);
  const model = path.join(paths.raw, "audio-check", "model", "ggml-base.en.bin");
  if (!existsSync(model)) throw new AudioRefused(`${model} is missing (the printing check's pinned model)`);
  const out = path.join(paths.bundles, readingDir(narrator, text));
  const work = path.join(paths.content, "audio-work", readingDir(narrator, text));
  mkdirSync(out, { recursive: true });
  mkdirSync(work, { recursive: true });
  const coreFile = readdirSync(paths.bundles).filter((f) => /^core\.v\d+\.db$/.test(f)).sort((x, y) => Number(/\d+/.exec(y)?.[0]) - Number(/\d+/.exec(x)?.[0]))[0];
  if (coreFile === undefined) throw new AudioRefused("no core bundle");
  let speaker: Speaker | null = null;
  if (isComputer(narrator)) {
    checkVoiceFile(narrator);
    speaker = await loadKokoro(path.join(paths.raw, "kokoro", "models"));
  }
  // Passage starts from the book's pericopes bundle, for the longer pause; none there, every gap is a verse's.
  const starts = new Set<number>();
  const pericopesVersion = highestVersionOnDisk(book.toLowerCase(), paths.bundles);
  if (pericopesVersion > 0) {
    const db = new DatabaseSync(path.join(paths.bundles, `${book.toLowerCase()}.v${pericopesVersion}.db`), { readOnly: true });
    for (const r of db.prepare("SELECT start_ord FROM pericopes").all()) starts.add(Number(r["start_ord"]));
    db.close();
  }
  const core = new DatabaseSync(path.join(paths.bundles, coreFile), { readOnly: true });
  const chapters: AudioChapterInfo[] = [];
  const missing: number[] = [];
  const lowMatch: Array<{ chapter: number; matched: number }> = [];
  try {
    for (let chapter = only ?? 1; chapter <= (only ?? BOOK_CODES[book].chapters); chapter++) {
      const base = `${book.toLowerCase()}-${String(chapter).padStart(3, "0")}`;
      const lo = verseOrd(book, chapter, 1);
      const verses = (core.prepare("SELECT ord, text FROM texts WHERE translation = ? AND ord BETWEEN ? AND ? ORDER BY ord").all(text, lo, lo + 998) as Array<{ ord: number; text: string }>).map((r) => ({ verse: r.ord % 1000, text: r.text }));
      let source: string;
      let spoken: SpokenPart[] | undefined;
      if (speaker !== null && isComputer(narrator)) {
        source = path.join(work, `${base}.voice.wav`);
        spoken = await synthesizeChapter(speaker, COMPUTER_VOICES[narrator].voice, verses, (verse) => starts.has(lo - 1 + verse), source);
      } else {
        const dir = path.join(paths.raw, "audio", narrator);
        const mp3 = isComputer(narrator) ? null : sourceFileName(dir, book, chapter, narrator);
        if (mp3 === null) {
          missing.push(chapter);
          continue;
        }
        source = path.join(dir, mp3);
      }
      // Made in work/ and moved into bundles/ only once past the floor: a chapter that fails never
      // replaces the listed file under its old sha256 (review, 12 Oct 2026).
      const m4a = path.join(work, `${base}.m4a`);
      const wav = path.join(work, `${base}.wav`);
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", source, "-ac", "1", "-c:a", "aac", "-b:a", "48k", m4a]);
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", source, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
      execFileSync("whisper-cli", ["-m", model, "-f", wav, "-l", "en", "-ml", "1", "-sow", "-oj", "-of", path.join(work, base), "-t", "8"], { stdio: "ignore" });
      const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", m4a]).toString().trim());
      const timings = chapterTimings(book, chapter, narrator, verses, heardWords(path.join(work, `${base}.json`)), duration, spoken);
      // The WAVs are about 0.3 GB an hour of reading and the recogniser's words are discarded (§D): gone
      // once heard, or a whole Bible fills the disk.
      for (const f of [wav, path.join(work, `${base}.json`), ...(isComputer(narrator) ? [source] : [])]) rmSync(f, { force: true });
      console.log(`  ${book} ${chapter}: ${(timings.matched * 100).toFixed(1)}% of the text heard, ${duration.toFixed(0)} s`);
      if (!passes(narrator, timings)) {
        lowMatch.push({ chapter, matched: timings.matched });
        rmSync(m4a, { force: true });
        continue;
      }
      const listed = path.join(out, `${base}.m4a`);
      renameSync(m4a, listed);
      const timingsFile = path.join(out, `${base}.json`);
      writeFileSync(timingsFile, `${JSON.stringify(timings)}\n`);
      chapters.push({
        chapter,
        file: `${readingDir(narrator, text)}/${base}.m4a`,
        sha256: sha256File(listed),
        bytes: statSync(listed).size,
        timings: `${readingDir(narrator, text)}/${base}.json`,
        timings_sha256: sha256File(timingsFile),
        duration,
      });
    }
  } finally {
    core.close();
  }
  return { book, narrator, chapters, missing, lowMatch };
}

/** The manifest entries for one voice, from the checked chapters on disk (`yada audio-manifest`). */
export function audioEntriesOnDisk(narrator: Narrator, root = process.env["YADA_ROOT"], text: AudioText = "BSB"): Array<{
  book: BookCode;
  translation: AudioText;
  narrator: Narrator;
  narrator_name: string;
  kind: "human" | "computer";
  credit: string;
  credit_url: string;
  chapters: AudioChapterInfo[];
  titles?: AudioTitles;
}> {
  const voiceDir = path.join(understandPaths(root).bundles, "audio", narrator);
  const pruned = readPruned(understandPaths(root).bundles);
  const dir = path.join(understandPaths(root).bundles, readingDir(narrator, text));
  if (!existsSync(dir)) return [];
  const byBook = new Map<BookCode, AudioChapterInfo[]>();
  for (const file of readdirSync(dir).filter((f) => /^[a-z0-9]{3}-\d{3}\.json$/.test(f)).sort()) {
    const base = file.slice(0, -5);
    const m4a = path.join(dir, `${base}.m4a`);
    const listed = `${readingDir(narrator, text)}/${base}.m4a`;
    // A chapter removed after publishing (audio-prune) is listed as the bucket holds it.
    const gone = pruned[listed];
    if (!existsSync(m4a) && gone === undefined) continue;
    const timings = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as ChapterTimings;
    if (timings.narrator !== narrator || !passes(narrator, timings)) continue;
    const list = byBook.get(timings.book) ?? [];
    list.push({
      chapter: timings.chapter,
      file: listed,
      sha256: existsSync(m4a) ? sha256File(m4a) : (gone?.sha256 ?? ""),
      bytes: existsSync(m4a) ? statSync(m4a).size : (gone?.bytes ?? 0),
      timings: `${readingDir(narrator, text)}/${file}`,
      timings_sha256: sha256File(path.join(dir, file)),
      duration: timings.duration,
    });
    byBook.set(timings.book, list);
  }
  return [...byBook].map(([book, chapters]) => {
    // The chapter names are the same whichever version is read: one file per voice and book.
    const titles = titlesOnDisk(voiceDir, narrator, book);
    return { book, translation: text, narrator, narrator_name: NARRATORS[narrator].name, kind: narratorKind(narrator), ...creditOf(narrator), chapters: chapters.sort((a, b) => a.chapter - b.chapter), ...(titles === undefined ? {} : { titles }) };
  });
}

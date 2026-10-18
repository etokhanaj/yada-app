/**
 * Readings to play along with (build plan Phase 4; canvas BA-01–08, LB-09–11): the two computer voices John
 * chose and kept, Heart and George (Kokoro, made on the Mac from each text's own words; 12–13 Oct 2026). The BSB
 * in both; the WEB, KJV and LSV in one voice each (John, 13 Oct 2026: WEB Heart, KJV George, LSV Heart),
 * published book by book. Everything is keyed by text as well as voice and book; BSB is the default, so a
 * manifest with BSB entries only behaves as before.
 *
 * A chapter downloads the first time it is played and is kept for offline use; "Download John" fetches the
 * whole book (BA-03, BA-04). Each file is checked against the manifest's size and sha256 before it is moved
 * into place, so a file on disk is a checked file: that is the whole record of what is downloaded, per
 * device, never synced. Nothing about the listener is stored or sent: the app only asks for a chapter.
 */

import { type AudioInfo, AudioInfoSchema, BOOK_CODES, type BookCode, type ChapterTimings, ChapterTimingsSchema, isBookCode } from "@yada/schema";
import { Directory, File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { AppState } from "react-native";
import { create } from "zustand";

import { resolveUrl, verifyDownload } from "../lib/translations";
import { MANIFEST_URL } from "./translations";

/** Heart first, then George: John's order (13 Oct 2026). */
const VOICE_ORDER = ["heart", "george"];
export const DEFAULT_NARRATOR = "heart";

/** A text a voice reads. Licensed versions are never among them (rule 9): the schema allows only these. */
export type ReadText = AudioInfo["translation"];
const READ_TEXTS: readonly ReadText[] = ["BSB", "WEB", "KJV", "LSV"];
/** The text a page's version is read in, or null where no voice reads it. */
export const readText = (translation: string): ReadText | null => READ_TEXTS.find((t) => t === translation) ?? null;
/** A book's reading in one text: "BSB/JHN". */
export const readingKey = (book: BookCode, text: ReadText = "BSB") => `${text}/${book}`;

interface RecordingsState {
  /** Every reading the manifest offers by Heart or George, Heart first. */
  all: AudioInfo[];
  /** The voice the reader chose in the Voice sheet (BA-03), kept per device. */
  narrator: string;
  /** Each book's reading that plays in each text (readingKey): the chosen voice's, else the voice that has it. */
  books: Partial<Record<string, AudioInfo>>;
  online: boolean | null;
  /** "Downloading John, 6 of 21 chapters" (BA-04), by readingKey. */
  downloading: Partial<Record<string, { done: number; total: number }>>;
  /** The last book download that failed, and why (BA-08: no room), by readingKey. */
  failed: Partial<Record<string, "space" | "network">>;
  /** Bumped when files change, so screens re-read what is on the phone. */
  version: number;
}

export const useRecordings = create<RecordingsState>(() => ({ all: [], narrator: DEFAULT_NARRATOR, books: {}, online: null, downloading: {}, failed: {}, version: 0 }));

/**
 * The reading each book plays in each text for `narrator`: its own where it reads it, else the voice that does.
 * The Heart or George choice only matters where both read the text (today the BSB).
 */
export function booksFor(all: readonly AudioInfo[], narrator: string): Partial<Record<string, AudioInfo>> {
  const books: Partial<Record<string, AudioInfo>> = {};
  for (const info of all) {
    const key = readingKey(info.book, info.translation);
    const have = books[key];
    if (have === undefined || (info.narrator === narrator && have.narrator !== narrator)) books[key] = info;
  }
  return books;
}

/** The reading that plays for `book` in `text`. */
export function readingOf(book: BookCode, text: ReadText = "BSB"): AudioInfo | undefined {
  return useRecordings.getState().books[readingKey(book, text)];
}

/** The voices that read `book` in `text`, Heart first (the Voice sheet's rows). */
export function readingsOf(book: BookCode, text: ReadText = "BSB"): AudioInfo[] {
  return useRecordings.getState().all.filter((a) => a.book === book && a.translation === text);
}

/** Heart or George: the only voices offered (John, 13 Oct 2026). */
export const isOffered = (narrator: string): boolean => VOICE_ORDER.includes(narrator);

/**
 * The Voice sheet's choice; the store keeps it for this launch, data/audio.ts keeps it per device. A voice
 * no longer offered (a phone that chose Barry Hays) becomes Heart, so his downloaded chapters are never
 * played under Heart's name (review, 13 Oct 2026).
 */
export function setNarrator(chosen: string): void {
  const narrator = isOffered(chosen) ? chosen : DEFAULT_NARRATOR;
  useRecordings.setState((s) => ({ narrator, books: booksFor(s.all, narrator) }));
}

/** Readings of voices no longer offered take space no screen shows: they go at launch (review, 13 Oct 2026). */
export function clearRetiredReadings(): void {
  const root = new Directory(Paths.document, "audio");
  if (!root.exists) return;
  for (const voice of root.list()) if (voice instanceof Directory && !isOffered(voice.name)) voice.delete();
}

const narratorOf = (book: BookCode, text: ReadText = "BSB") => readingOf(book, text)?.narrator ?? useRecordings.getState().narrator;
/** As the manifest lays them out: the BSB in audio/<voice>/, another text in audio/<voice>/<web|kjv|lsv>/. */
const folder = (narrator: string, text: ReadText = "BSB") =>
  text === "BSB" ? new Directory(Paths.document, "audio", narrator) : new Directory(Paths.document, "audio", narrator, text.toLowerCase());
const base = (book: BookCode, chapter: number) => `${book.toLowerCase()}-${String(chapter).padStart(3, "0")}`;
const audioFile = (book: BookCode, chapter: number, narrator: string, text: ReadText) => new File(folder(narrator, text), `${base(book, chapter)}.m4a`);
const timingsFile = (book: BookCode, chapter: number, narrator: string, text: ReadText) => new File(folder(narrator, text), `${base(book, chapter)}.json`);
/** The book's chapter names in this voice, one short file shared by its BSB, WEB, KJV and LSV readings. */
const titlesFile = (book: BookCode, narrator: string) => new File(folder(narrator), `${book.toLowerCase()}-titles.m4a`);
/** AVAudioPlayer takes a path. */
const pathOf = (file: File) => decodeURIComponent(file.uri.replace(/^file:\/\//, ""));

let refreshing: Promise<void> | null = null;

/**
 * The manifest's `audio` list as last seen, kept on the phone: offline, a downloaded reading still has
 * its name, so it is named as the computer voice it is and the Voice sheet keeps its rows
 * (review, 12 Oct 2026).
 */
const catalogueFile = () => new File(new Directory(Paths.document, "audio"), "catalogue.json");

function parseAudioList(list: unknown): AudioInfo[] {
  // Heart and George only, in John's order: he kept the two computer voices and set the others aside
  // (13 Oct 2026), so a human reading the manifest still lists is not offered.
  const all = (Array.isArray(list) ? list : []).flatMap((raw) => {
    const parsed = AudioInfoSchema.safeParse(raw);
    // Every text a voice reads (build 6): the player reads each by its own text and timings.
    return parsed.success && VOICE_ORDER.includes(parsed.data.narrator) ? [parsed.data] : [];
  });
  return all.sort((a, b) => VOICE_ORDER.indexOf(a.narrator) - VOICE_ORDER.indexOf(b.narrator));
}

async function readCatalogue(): Promise<void> {
  if (useRecordings.getState().all.length > 0) return;
  const file = catalogueFile();
  if (!file.exists) return;
  try {
    const all = parseAudioList(JSON.parse(await file.text()));
    useRecordings.setState((s) => ({ all, books: booksFor(all, s.narrator) }));
  } catch {
    // A damaged copy is replaced at the next manifest read.
  }
}

/** The manifest's `audio` list, once a launch (a failure lets the next play try again). */
export function refreshRecordings(): Promise<void> {
  refreshing ??= (async () => {
    if (MANIFEST_URL === "") {
      useRecordings.setState({ online: false });
      await readCatalogue();
      return;
    }
    try {
      const response = await fetch(MANIFEST_URL, { headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) throw new Error(`manifest ${response.status}`);
      const list = ((await response.json()) as { audio?: unknown }).audio;
      const all = parseAudioList(list);
      useRecordings.setState((s) => ({ all, books: booksFor(all, s.narrator), online: true }));
      new Directory(Paths.document, "audio").create({ intermediates: true, idempotent: true });
      catalogueFile().write(JSON.stringify(list ?? []));
    } catch {
      useRecordings.setState({ online: false });
      refreshing = null;
      await readCatalogue();
    }
  })();
  return refreshing;
}

export interface Recording {
  readonly narrator: string;
  /** The text it reads: its timings fit that text's words only. */
  readonly text: ReadText;
  readonly path: string;
  readonly timings: ChapterTimings;
}

/** The chapter's recording when it is on the phone; null otherwise. Never fetches. */
export async function recordingOnPhone(book: BookCode, chapter: number, text: ReadText = "BSB", narrator = narratorOf(book, text)): Promise<Recording | null> {
  const audio = audioFile(book, chapter, narrator, text);
  const timings = timingsFile(book, chapter, narrator, text);
  if (!audio.exists || !timings.exists) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(await timings.text());
  } catch {
    // A truncated file is not a recording: it is fetched again rather than stalling Listen (review, 12 Oct 2026).
    return null;
  }
  const parsed = ChapterTimingsSchema.safeParse(raw);
  return parsed.success ? { narrator, text, path: pathOf(audio), timings: parsed.data } : null;
}

/** Whether the manifest offers this chapter in the reading this book plays in `text`. */
export function isRecorded(book: BookCode, chapter: number, text: ReadText = "BSB"): boolean {
  return readingOf(book, text)?.chapters.some((c) => c.chapter === chapter) === true;
}

export interface FetchOptions {
  /** The share fetched so far, 0 to 1 (BA-02's ring). */
  readonly onProgress?: (share: number) => void;
  /** BA-02's stop. */
  readonly signal?: AbortSignal;
}

/** The server answered, but not with the file the manifest lists: a fault, not the connection. */
class Mismatch extends Error {}

async function fetchChecked(url: string, target: File, expected: { bytes: number; sha256: string }, options: FetchOptions = {}): Promise<void> {
  const partial = new File(target.parentDirectory, `${target.name}.partial`);
  if (partial.exists) partial.delete();
  const { onProgress, signal } = options;
  try {
    await File.createDownloadTask(url, partial, {
      // The manifest's size, not the response's: a server that sends no length still moves the ring.
      ...(onProgress === undefined ? {} : { onProgress: ({ bytesWritten }) => onProgress(Math.min(1, bytesWritten / expected.bytes)) }),
      ...(signal === undefined ? {} : { signal }),
    }).downloadAsync();
  } catch (error) {
    // A stopped or failed download leaves nothing behind (BA-02's stop).
    if (partial.exists) partial.delete();
    throw error;
  }
  if (!(await verifyDownload(await partial.bytes(), expected))) {
    partial.delete();
    throw new Mismatch();
  }
  if (target.exists) target.delete();
  partial.move(target);
}

/** One fetch per chapter at a time: the first play and Download John share a `.partial` file. */
const inFlight = new Map<string, Promise<Recording | null>>();

/** BA-02: the first play of a chapter fetches it, then plays. Null when it can't be had (offline: BA-05). */
export function ensureChapter(book: BookCode, chapter: number, options: FetchOptions = {}, text: ReadText = "BSB", narrator = narratorOf(book, text)): Promise<Recording | null> {
  // The voice is fixed once per fetch: a switch in the Voice sheet while it runs must not file one
  // voice's chapter under another's folder (review, 12 Oct 2026).
  const key = `${narrator}/${text}/${base(book, chapter)}`;
  const running = inFlight.get(key);
  if (running !== undefined) return running;
  const fetching = fetchChapter(book, chapter, narrator, text, options).finally(() => inFlight.delete(key));
  inFlight.set(key, fetching);
  return fetching;
}

async function fetchChapter(book: BookCode, chapter: number, narrator: string, text: ReadText, options: FetchOptions): Promise<Recording | null> {
  const here = await recordingOnPhone(book, chapter, text, narrator);
  if (here !== null) return here;
  await refreshRecordings();
  const info = useRecordings
    .getState()
    .all.find((a) => a.book === book && a.narrator === narrator && a.translation === text)
    ?.chapters.find((c) => c.chapter === chapter);
  if (info === undefined || useRecordings.getState().online !== true) return null;
  try {
    folder(narrator, text).create({ intermediates: true, idempotent: true });
    const timings = await fetchTimings(info.timings, info.timings_sha256);
    await fetchChecked(resolveUrl(MANIFEST_URL, info.file), audioFile(book, chapter, narrator, text), { bytes: info.bytes, sha256: info.sha256 }, options);
    timingsFile(book, chapter, narrator, text).write(timings);
  } catch (error) {
    // A failed fetch that was not stopped and not a bad file asks the manifest again, and that answer says
    // whether the phone is offline (BA-05). A file the server lacks is not the connection: on 15 Oct 2026 a
    // 404 for a listed chapter showed "You're offline." while the manifest loaded (UX pass).
    if (options.signal?.aborted !== true && !(error instanceof Mismatch)) {
      refreshing = null;
      await refreshRecordings();
    }
    return null;
  }
  useRecordings.setState((s) => ({ version: s.version + 1 }));
  // The book's chapter names come down with its first chapter, so the next chapter can be announced offline.
  void ensureTitles(book, narrator);
  return recordingOnPhone(book, chapter, text, narrator);
}

export interface ChapterTitle {
  readonly path: string;
  readonly start: number;
  readonly end: number;
}

/** Where `chapter`'s name is said in the voice's titles file, when that file is on the phone. Never fetches. */
export function titleOnPhone(book: BookCode, chapter: number, narrator = narratorOf(book)): ChapterTitle | null {
  // One file per voice and book, listed under each of its texts' entries (packages/pipeline audio-titles).
  const titles = useRecordings.getState().all.find((a) => a.book === book && a.narrator === narrator && a.titles !== undefined)?.titles;
  const span = titles?.spans.find((t) => t.chapter === chapter);
  const file = titlesFile(book, narrator);
  if (span === undefined || !file.exists) return null;
  return { path: pathOf(file), start: span.start, end: span.end };
}

/**
 * The titles file, checked like a chapter. Optional: without it the iPhone voice says the same words
 * (spokenTitle), so a failure here is never the reader's problem and never "offline".
 */
function ensureTitles(book: BookCode, narrator: string): Promise<void> {
  // Each chapter fetched asks for the titles file; one fetch at a time, as their shared .partial needs.
  const key = `titles/${narrator}/${book}`;
  const running = titlesInFlight.get(key);
  if (running !== undefined) return running;
  const fetching = fetchTitles(book, narrator).finally(() => titlesInFlight.delete(key));
  titlesInFlight.set(key, fetching);
  return fetching;
}

const titlesInFlight = new Map<string, Promise<void>>();

async function fetchTitles(book: BookCode, narrator: string): Promise<void> {
  const titles = useRecordings.getState().all.find((a) => a.book === book && a.narrator === narrator && a.titles !== undefined)?.titles;
  const file = titlesFile(book, narrator);
  if (titles === undefined || file.exists) return;
  try {
    await fetchChecked(resolveUrl(MANIFEST_URL, titles.file), file, { bytes: titles.bytes, sha256: titles.sha256 });
  } catch {
    // The next chapter fetched tries again.
  }
}

/** Timings are small and checked by sha256 alone (their size is not in the manifest). */
async function fetchTimings(path: string, sha256: string): Promise<string> {
  const response = await fetch(resolveUrl(MANIFEST_URL, path));
  if (!response.ok) throw new Mismatch(`timings ${response.status}`);
  const text = await response.text();
  const bytes = new TextEncoder().encode(text);
  if (!(await verifyDownload(bytes, { bytes: bytes.length, sha256 }))) throw new Mismatch("timings sha256 mismatch");
  return text;
}

/** How many of a book's recorded chapters in `text` are on the phone, and their total size in bytes. */
export function bookOnPhone(book: BookCode, text: ReadText = "BSB"): { chapters: number; total: number; bytes: number } {
  const info = readingOf(book, text);
  if (info === undefined) return { chapters: 0, total: 0, bytes: 0 };
  const here = info.chapters.filter((c) => audioFile(book, c.chapter, info.narrator, text).exists);
  return { chapters: here.length, total: info.chapters.length, bytes: info.chapters.reduce((n, c) => n + c.bytes, 0) };
}

/** "Download John" (BA-03, BA-04): chapter by chapter, so a stopped download keeps what it fetched. */
/**
 * NT-08: a book download that finished while Yada was not on screen says so once, then nothing more. The transfer
 * itself runs in iOS's background session (expo-file-system's default). Only when notifications are already allowed;
 * this never asks.
 */
async function notifyIfAway(book: BookCode, chapters: number): Promise<void> {
  if (AppState.currentState === "active") return;
  if ((await Notifications.getPermissionsAsync()).status !== "granted") return;
  await Notifications.scheduleNotificationAsync({
    identifier: `downloaded-${book}`,
    content: { title: `${BOOK_CODES[book].name} is downloaded`, body: `${chapters} chapters, ready to listen offline.` },
    trigger: null,
  });
}

export async function downloadBook(book: BookCode, text: ReadText = "BSB"): Promise<boolean> {
  await refreshRecordings();
  const info = readingOf(book, text);
  if (info === undefined) return false;
  const key = readingKey(book, text);
  // The voice chosen when Download was tapped, for the whole book.
  const narrator = info.narrator;
  const need = info.chapters.filter((c) => !audioFile(book, c.chapter, narrator, text).exists);
  const room = Paths.availableDiskSpace;
  if (room < need.reduce((n, c) => n + c.bytes, 0) * 1.1) {
    useRecordings.setState((s) => ({ failed: { ...s.failed, [key]: "space" } }));
    return false;
  }
  useRecordings.setState((s) => {
    const { [key]: _cleared, ...failed } = s.failed;
    return { failed, downloading: { ...s.downloading, [key]: { done: info.chapters.length - need.length, total: info.chapters.length } } };
  });
  let ok = true;
  const run = bookRuns;
  for (const c of need) {
    // Remove my data or Remove all downloads stopped it: no more chapters land after they were removed.
    if (run !== bookRuns) {
      ok = false;
      break;
    }
    if ((await ensureChapter(book, c.chapter, {}, text, narrator)) === null) {
      ok = false;
      break;
    }
    useRecordings.setState((s) => {
      const now = s.downloading[key];
      return now === undefined ? {} : { downloading: { ...s.downloading, [key]: { ...now, done: now.done + 1 } } };
    });
  }
  if (ok) await ensureTitles(book, narrator);
  if (ok) await notifyIfAway(book, info.chapters.length);
  useRecordings.setState((s) => {
    const { [key]: _done, ...downloading } = s.downloading;
    return { downloading, ...(ok ? {} : { failed: { ...s.failed, [key]: "network" as const } }) };
  });
  return ok;
}

/**
 * "Remove John's audio" (BA-07): every voice's chapters of the book, so a reading downloaded before a
 * switch never stays where no screen can reach it (review, 12 Oct 2026). Plain files, never open as a
 * database, so they go at once.
 */
export function removeBook(book: BookCode, only?: string, text: ReadText = "BSB"): void {
  const root = new Directory(Paths.document, "audio");
  const prefix = `${book.toLowerCase()}-`;
  for (const voice of root.exists ? root.list() : []) {
    // Downloads removes one voice's book (ST-02); the Voice sheet, every voice's; each in one text.
    if (!(voice instanceof Directory) || (only !== undefined && voice.name !== only)) continue;
    const dir = text === "BSB" ? voice : new Directory(voice, text.toLowerCase());
    if (!dir.exists) continue;
    // The chapter names are the voice's, shared by its texts: they stay while another text of the book is here.
    for (const f of dir.list()) if (f instanceof File && f.name.startsWith(prefix) && !f.name.includes("-titles")) f.delete();
    const titles = new File(voice, `${book.toLowerCase()}-titles.m4a`);
    if (titles.exists && !hasBook(voice, book)) titles.delete();
  }
  useRecordings.setState((s) => ({ version: s.version + 1 }));
}

/** Whether any text of `book` is still in this voice's folders (the titles file goes with the last). */
function hasBook(voice: Directory, book: BookCode): boolean {
  const chapter = new RegExp(`^${book.toLowerCase()}-\\d{3}\\.m4a$`);
  return [voice, ...READ_TEXTS.filter((t) => t !== "BSB").map((t) => new Directory(voice, t.toLowerCase()))].some(
    (dir) => dir.exists && dir.list().some((f) => f instanceof File && chapter.test(f.name)),
  );
}

export interface ReadingOnPhone {
  readonly narrator: string;
  readonly book: BookCode;
  readonly text: ReadText;
  readonly chapters: number;
  readonly bytes: number;
}

/** Downloads (ST-02, LB-11): each voice's books on the phone in each text, read from the folders, with what they take. */
export function readingsOnPhone(): ReadingOnPhone[] {
  const root = new Directory(Paths.document, "audio");
  if (!root.exists) return [];
  const out = new Map<string, ReadingOnPhone>();
  for (const voice of root.list()) {
    if (!(voice instanceof Directory) || !isOffered(voice.name)) continue;
    for (const text of READ_TEXTS as readonly ReadText[]) {
      const dir = text === "BSB" ? voice : new Directory(voice, text.toLowerCase());
      if (!dir.exists) continue;
      for (const f of dir.list()) {
        const m = f instanceof File ? /^([a-z0-9]{3})-\d{3}\.(m4a|json)$/.exec(f.name) : null;
        const book = m?.[1]?.toUpperCase();
        if (m === null || m === undefined || book === undefined || !(f instanceof File) || !isBookCode(book)) continue;
        const key = `${voice.name}/${text}/${book}`;
        const row = out.get(key) ?? { narrator: voice.name, book, text, chapters: 0, bytes: 0 };
        out.set(key, { ...row, chapters: row.chapters + (m[2] === "m4a" ? 1 : 0), bytes: row.bytes + (f.size ?? 0) });
      }
    }
  }
  return [...out.values()];
}

let bookRuns = 0;

/** Remove my data and Remove all downloads: every reading on the phone, any book download stopped first. */
export function removeAllReadings(): void {
  bookRuns++;
  const root = new Directory(Paths.document, "audio");
  if (root.exists) root.delete();
  useRecordings.setState((s) => ({ all: [], books: {}, version: s.version + 1 }));
  refreshing = null;
}

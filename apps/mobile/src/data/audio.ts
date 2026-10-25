/**
 * The read-along controller: speaks the session verse by verse through modules/yada-speech and
 * keeps state/audio.ts current. Screens call these functions; nothing here renders.
 *
 * Edge cases (coordinator, 11 Oct 2026):
 * - A call, Siri or another app's audio pauses and stays paused, unless iOS says to resume.
 *   Headphones or Bluetooth going away pauses.
 * - The end of a chapter goes on into the next chapter of the book; the end of a book stops.
 * - Switching translation while playing carries on from the same verse in the new text, if it is
 *   one audio may read (lib/audio/session.ts canSpeak); a licensed one pauses. That gate is the
 *   only way into a reading, so no licensed text is ever read aloud (rule 9).
 * - A speed or voice change takes effect at once, from the word being spoken.
 *
 * Every verse is read by Heart or George from the chapter's recording (Build 12, John 24 Oct 2026: "our default
 * sound is the apple voice, can we change that?"). The iPhone voice is gone: offline with the chapter not on the
 * phone, or a stream that fails, the session pauses and LS-31 says so and offers the download (`unavailable`).
 */

import type { BookCode } from "@yada/schema";
import type { SQLiteDatabase } from "expo-sqlite";

import { Speech } from "../../modules/yada-speech";
import { afterVerse, canSpeak, isSpeed, nowPlayingFor } from "../lib/audio/session";
import { afterVerse as stopOrRepeat, keepStop, type Repeat, type SetEnd, type StopChoice, stopFrom } from "../lib/audio/stop";
import { type SpokenText, spokenFor, spokenOffsetOf, wordAt, type WordRange, wordRanges } from "../lib/audio/text";
import { chapterTitle } from "../lib/reader";
import { type AudioSession, currentVerse, useAudio } from "../state/audio";
import { useSettings } from "../state/settings";
import { asDb } from "./AppData";
import { getChapter } from "./queries";
import { isLicensedCode } from "./licensed";
import {
  clearRetiredReadings,
  DEFAULT_NARRATOR,
  isRecorded,
  readText,
  type Recording,
  recordingOnPhone,
  refreshRecordings,
  saveStreamed,
  setNarrator,
  streamChapter,
  titleOnPhone,
  useRecordings,
} from "./recordings";
import { loadPericopes } from "./understand";
import { pericopeForVerse, type PericopeRow } from "../lib/pericopes";
import { saveSetting } from "./user";

let core: SQLiteDatabase | null = null;
let user: SQLiteDatabase | null = null;

/** The utterance whose events count; any other id is a verse that was cut off. */
let activeId: string | null = null;
let counter = 0;
/** The verse being spoken and its spoken form. Ranges arrive as offsets into the whole form. */
let spoken: { text: SpokenText; words: WordRange[] } | null = null;
/** Paused by a call or Siri rather than by the reader, so iOS may resume it. */
let pausedByInterruption = false;
/** Where in the recording the verse now playing began (seconds): the lock screen's bar resumes from there (23 Oct 2026). */
let segmentStart: number | null = null;
/** The ords that open a passage in the session's book, for the longer rest before them. */
let passageStarts: { book: BookCode; ords: ReadonlySet<number>; rows: readonly PericopeRow[] } | null = null;
/** The chapter recording the session is reading from, when it reads the recording (data/recordings.ts). */
let recording: { book: BookCode; chapter: number; rec: Recording } | null = null;
/** Counts prepareRecording calls, so a call overtaken by a newer one writes nothing. */
let prepares = 0;
/** RD-34: a voice's sample holds the player, so Play starts the session's verse again rather than resuming it. */
let sample: { id: string; rec: Recording } | null = null;

const set = (patch: Partial<AudioSession>) => {
  const s = useAudio.getState().session;
  if (s !== null) useAudio.setState({ session: { ...s, ...patch } });
};

/** Once, from the root layout after the databases open. Returns the unsubscribe. */
export function initAudio(coreDb: SQLiteDatabase, userDb: SQLiteDatabase, stored: Record<string, string>): () => void {
  core = coreDb;
  user = userDb;
  const speed = Number(stored["audioSpeed"]);
  useAudio.setState({ speed: isSpeed(speed) ? speed : 1 });
  setNarrator(stored["audioNarrator"] ?? DEFAULT_NARRATOR);
  clearRetiredReadings();
  if (Speech === null) return () => undefined;
  const subs = [
    Speech.addListener("onRange", ({ id, location }) => {
      if (id !== activeId || spoken === null) return;
      const i = wordAt(spoken.words, spoken.text, location);
      if (i !== null) set({ word: spoken.words[i] ?? null });
    }),
    Speech.addListener("onFinish", ({ id }) => {
      if (id !== activeId) return;
      // The chapter's name has been said: its first verse follows (LB-08). A title's id says it is one, so
      // its end never counts as a verse's.
      if (id.startsWith("title:")) {
        set({ titling: false });
        // A pause that landed as the name ended keeps verse 1 waiting for Play (review, 15 Oct 2026).
        if (useAudio.getState().session?.status === "playing") speakCurrent();
        else prepareCurrent();
      } else void advance();
    }),
    Speech.addListener("onRemote", ({ command }) => remoteCommand(command)),
    Speech.addListener("onInterruption", ({ began, shouldResume }) => {
      const s = useAudio.getState().session;
      if (s === null) return;
      if (began && s.status === "playing") {
        pausedByInterruption = true;
        set({ status: "paused" });
        updateNowPlaying();
      } else if (!began && pausedByInterruption && shouldResume) {
        resume();
      }
    }),
    Speech.addListener("onRouteLost", () => {
      if (useAudio.getState().session?.status === "playing") pause();
    }),
    Speech.addListener("onBuffering", ({ waiting }) => {
      if (sample !== null) return;
      if (useAudio.getState().session?.buffering !== waiting) set({ buffering: waiting });
    }),
    // A streamed chapter is all here: kept once it checks out, so the next play needs no connection.
    Speech.addListener("onStreamSaved", ({ url }) => {
      if (recording?.rec.path === url) void saveStreamed(recording.rec);
      else if (sample?.rec.path === url) void saveStreamed(sample.rec);
    }),
    // The connection went mid-chapter: the reading pauses at this word and LS-31 offers Try again.
    Speech.addListener("onStreamFailed", ({ url }) => {
      if (recording?.rec.path !== url) return;
      recording = null;
      segmentStart = null;
      set({ recorded: false, buffering: false });
      unavailable(useRecordings.getState().online === false ? "offline" : "failed");
    }),
  ];
  const unsubscribeSettings = useSettings.subscribe((now, before) => {
    if (now.translation !== before.translation) void switchTranslation(now.translation);
  });
  return () => {
    subs.forEach((s) => s.remove());
    unsubscribeSettings();
  };
}

/** Whether Listen is offered for a page in `translation`: the BSB under a licensed one (EG-03), never nothing heard. */
export function canListen(translation: string): boolean {
  return Speech !== null && audioTranslation(translation) !== null;
}

/** LS-31: nothing can read this chapter now. The session pauses where it is and the sheet says why. */
function unavailable(reason: "offline" | "failed"): void {
  const s = useAudio.getState().session;
  if (s === null) return;
  activeId = null;
  void Speech?.stop();
  set({ status: "paused", buffering: false });
  useAudio.setState({ unavailable: { reason, book: s.book, translation: s.translation } });
  updateNowPlaying();
}

/** Listen and Play from: read `book` `chapter` from `verse` in the reader's translation. */
export async function listen(book: BookCode, chapter: number, verse: number): Promise<void> {
  // EG-03 (John, 12 Oct 2026): under a licensed page Listen plays the BSB; the licensed text is never spoken.
  const translation = audioTranslation(useSettings.getState().translation);
  if (core === null || translation === null) return;
  const verses = await getChapter(asDb(core), book, chapter, translation);
  if (verses.length === 0) return;
  const index = Math.max(0, verses.findIndex((v) => v.verse >= verse));
  useAudio.setState({ session: { book, chapter, translation, verses, index, word: null, status: "playing" } });
  void loadPassageStarts(book);
  await prepareRecording(book, chapter);
  // A pause while the timings were fetched leaves the session paused; nothing starts by itself.
  const now = useAudio.getState().session;
  if (now?.status === "playing" && now.book === book && now.chapter === chapter) speakCurrent();
}

/** LS-31's Try again: fetch the chapter once more and carry on from where it paused. */
export async function tryAgain(): Promise<void> {
  useAudio.setState({ unavailable: null });
  const s = useAudio.getState().session;
  if (s === null) return;
  set({ status: "playing" });
  await prepareRecording(s.book, s.chapter);
  if (useAudio.getState().session?.status === "playing") speakCurrent(useAudio.getState().session?.word ?? null);
}

/** Headphones, the lock screen's Now Playing and Control Center all come here. */
export function remoteCommand(command: string): void {
  if (command === "play") resume();
  else if (command === "pause") pause();
  else if (command === "toggle") toggle();
  else if (command === "next") next();
  else if (command === "previous") previous();
}

/** Remove my data (ST-03): the reading stops and the player goes; nothing is left to resume. */
export function endSession(): void {
  recording = null;
  activeId = null;
  void Speech?.stop();
  useAudio.setState({ session: null, stop: null, repeat: null });
}

/** LB-02: a stop at a natural break, or none; DR-08: `set` is where today's psalms end, for "set". */
export function setStop(choice: StopChoice | null, set: SetEnd | null = null): void {
  useAudio.setState({ stop: choice === null ? null : stopFrom(choice, Date.now(), set) });
}

/** LB-05: a repeat, which clears a stop the loop would never reach (LB-07). */
export function setRepeat(repeat: Repeat | null): void {
  useAudio.setState((a) => ({ repeat, stop: keepStop(a.stop, repeat) }));
}

/** What the read-along reads for a page in `translation`: itself, the BSB under a licensed one, or nothing. */
export function audioTranslation(translation: string): string | null {
  if (canSpeak(translation)) return translation;
  return isLicensedCode(translation) ? "BSB" : null;
}

/**
 * The chapter's reading by Heart or George: the first play streams it, saved as it plays (ST-01). When it can't be
 * had, the session pauses and LS-31 says why: offline, or a reading that didn't load (never "offline" when online).
 */
async function prepareRecording(book: BookCode, chapter: number): Promise<void> {
  // Only the latest call writes: Listen on another chapter while one was fetching must not get the
  // older chapter's recording when that fetch lands (review, 12 Oct 2026).
  const token = ++prepares;
  const current = () => token === prepares;
  const s = useAudio.getState().session;
  recording = null;
  if (s?.buffering === true) set({ buffering: false });
  // The session's own text, read by its own reading (LB-09): the BSB, WEB, KJV or LSV. A licensed text never
  // reaches a session (audioTranslation, EG-03), and readText would refuse it anyway (rule 9).
  const text = s === null ? null : readText(s.translation);
  if (s === null || text === null) {
    set({ recorded: false });
    return;
  }
  let rec = await recordingOnPhone(book, chapter, text);
  if (rec === null) await refreshRecordings();
  if (!current()) return;
  if (rec === null && isRecorded(book, chapter, text) && useRecordings.getState().online === true) {
    // ST-01: the first play streams; only its small timings file is waited for.
    rec = await streamChapter(book, chapter, text);
    if (!current()) return;
  }
  recording = rec === null ? null : { book, chapter, rec };
  set({ recorded: rec !== null });
  if (rec === null) unavailable(useRecordings.getState().online === true ? "failed" : "offline");
}

/** The Voice sheet (BA-03): Heart or George, kept per device. */
export async function chooseReading(narrator: string): Promise<void> {
  setNarrator(narrator);
  if (user !== null) void saveSetting(user, "audioNarrator", narrator);
  const s = useAudio.getState().session;
  if (s === null) return;
  await prepareRecording(s.book, s.chapter);
  if (useAudio.getState().session?.status === "playing") speakCurrent(useAudio.getState().session?.word ?? null);
}

/**
 * RD-34: a voice's sample is the first verse of the session's chapter in that voice, streamed if it isn't on the
 * phone. The session pauses for it; Play then reads its own verse again from the word it stopped at.
 */
export async function playSample(narrator: string): Promise<void> {
  const s = useAudio.getState().session;
  if (s === null || Speech === null) return;
  pause();
  const rec = await streamChapter(s.book, s.chapter, readText(s.translation) ?? "BSB", narrator);
  const first = rec?.timings.verses[0];
  if (rec === null || first === undefined || useAudio.getState().session?.status === "playing") return;
  activeId = null;
  const id = `sample:${narrator}#${++counter}`;
  sample = { id, rec };
  const segment = rec.stream === undefined ? { path: rec.path } : { path: rec.path, savePath: rec.stream.savePath, bytes: rec.stream.bytes };
  Speech.playSegment(id, { ...segment, start: first.start, end: first.end, times: [], locations: [] }, useAudio.getState().speed).catch(() => undefined);
}

/**
 * RD-32: where the reading is in its chapter's recording and the recording's length, in seconds, from the timings:
 * the word being spoken, else the verse's start. Read on each change of the audio store, never on a timer (no
 * polling, John, 18 Oct 2026). Null until the chapter's recording is ready.
 */
export function playingTime(s: AudioSession): { elapsed: number; duration: number } | null {
  if (recording === null || recording.book !== s.book || recording.chapter !== s.chapter || s.recorded !== true) return null;
  const { timings } = recording.rec;
  const verse = currentVerse(s);
  const timing = verse === undefined ? undefined : timings.verses.find((t) => t.verse === verse.verse);
  if (timing === undefined) return { elapsed: 0, duration: timings.duration };
  const k = s.word === null || spoken === null ? -1 : spoken.words.findIndex((w) => w.start === s.word?.start);
  return { elapsed: (k < 0 ? undefined : timing.words[k]) ?? timing.start, duration: timings.duration };
}

async function loadPassageStarts(book: BookCode): Promise<void> {
  if (passageStarts?.book === book) return;
  const pericopes = await loadPericopes(book);
  passageStarts = { book, ords: new Set(pericopes.map((p) => p.start_ord)), rows: pericopes };
  updateNowPlaying();
}

/** The full player's lines and Play from within the session's chapter. */
export function jumpTo(verse: number): void {
  const s = useAudio.getState().session;
  if (s === null) return;
  const index = s.verses.findIndex((v) => v.verse === verse);
  if (index < 0) return;
  set({ index, word: null, titling: false, status: "playing" });
  speakCurrent();
}

export function pause(): void {
  const s = useAudio.getState().session;
  if (s === null || s.status !== "playing") return;
  pausedByInterruption = false;
  set({ status: "paused" });
  void Speech?.pause();
  updateNowPlaying();
}

export function resume(): void {
  const s = useAudio.getState().session;
  if (s === null || s.status === "playing") return;
  pausedByInterruption = false;
  if (s.status === "finished") {
    // Play after the end of the book reads its last chapter again from the top.
    set({ index: 0, word: null, status: "playing" });
    speakCurrent();
    return;
  }
  if (s.titling === true) {
    // A pause during the chapter's name: Play says the name again, then the verse (docs/build-6-decisions.md).
    set({ status: "playing" });
    sayTitle();
    return;
  }
  set({ status: "playing" });
  updateNowPlaying();
  useAudio.setState({ unavailable: null });
  if (s.recorded !== true) {
    // Play after the reading couldn't be had tries it again; still nothing, and LS-31 says so again.
    void prepareRecording(s.book, s.chapter).then(() => {
      if (useAudio.getState().session?.status === "playing") speakCurrent(useAudio.getState().session?.word ?? null);
    });
    return;
  }
  if (sample !== null) {
    sample = null;
    speakCurrent(s.word);
    return;
  }
  // Nothing to continue when the pause fell between two verses: start the verse again.
  void Speech?.resume().then((continued) => {
    if (!continued && useAudio.getState().session?.status === "playing") speakCurrent(useAudio.getState().session?.word ?? null);
  });
}

export function toggle(): void {
  if (useAudio.getState().session?.status === "playing") pause();
  else resume();
}

export function next(): void {
  const s = useAudio.getState().session;
  if (s === null) return;
  if (s.titling === true) {
    // Next during the name skips it to the chapter's first verse.
    set({ titling: false, word: null });
    if (s.status === "playing") speakCurrent();
    else prepareCurrent();
    return;
  }
  if (s.index + 1 < s.verses.length) {
    set({ index: s.index + 1, word: null, status: s.status === "finished" ? "playing" : s.status });
    if (useAudio.getState().session?.status === "playing") speakCurrent();
    else prepareCurrent();
  } else {
    void advance(true);
  }
}

export function previous(): void {
  const s = useAudio.getState().session;
  if (s === null) return;
  set({ index: Math.max(0, s.index - 1), word: null, titling: false, status: s.status === "finished" ? "playing" : s.status });
  if (useAudio.getState().session?.status === "playing") speakCurrent();
  else prepareCurrent();
}

export function setSpeed(speed: number): void {
  if (!isSpeed(speed) || speed === useAudio.getState().speed) return;
  useAudio.setState({ speed });
  if (user !== null) void saveSetting(user, "audioSpeed", String(speed));
  restartAtWord();
}

/** A speed or voice change restarts the verse at the word being read, in the new speed or reading. */
function restartAtWord(): void {
  const s = useAudio.getState().session;
  if (s?.status === "playing") speakCurrent(s.word);
}

/** Play the current verse from the chapter's recording, from `fromWord` when resuming mid-verse. */
function speakCurrent(fromWord: WordRange | null = null): void {
  const s = useAudio.getState().session;
  const verse = s === null ? undefined : currentVerse(s);
  if (s === null || verse === undefined || Speech === null || !canSpeak(s.translation)) return;
  // A verse playing ends the chapter's name: a speed or voice change during the name otherwise left the player
  // showing the title over verse 1 for the whole chapter (review, 15 Oct 2026).
  if (s.titling === true) set({ titling: false });
  // The recording reads the session's own text only: its timings fit that text's words (LB-09).
  if (recording === null || recording.rec.text !== s.translation || recording.book !== s.book || recording.chapter !== s.chapter) {
    unavailable(useRecordings.getState().online === true ? "failed" : "offline");
    return;
  }
  const timing = recording.rec.timings.verses.find((t) => t.verse === verse.verse);
  if (timing === undefined) {
    // A verse the recording leaves out (a bracketed one the reading skips): on to the next.
    void advance();
    return;
  }
  const { speed } = useAudio.getState();
  const text = spokenFor(verse.text);
  spoken = { text, words: wordRanges(verse.text) };
  const words = spoken.words;
  // Timings built from another edition of the text would light the wrong words: such a verse still plays from the
  // recording, unlit (review, 12 Oct 2026; Build 12 removed the iPhone voice it used to fall back to).
  const lit = timing.words.length === words.length;
  // Word k of the text has time k (both are the verse's words split at spaces); the pill follows them.
  const k = !lit || fromWord === null ? 0 : Math.max(0, words.findIndex((w) => w.start === fromWord.start));
  const id = `${s.book}.${s.chapter}.${verse.verse}#${++counter}`;
  activeId = id;
  sample = null;
  segmentStart = lit ? (timing.words[k] ?? timing.start) : timing.start;
  Speech.playSegment(
    id,
    {
      path: recording.rec.path,
      ...(recording.rec.stream === undefined ? {} : { savePath: recording.rec.stream.savePath, bytes: recording.rec.stream.bytes }),
      start: segmentStart,
      end: timing.end,
      times: lit ? timing.words.slice(k) : [],
      locations: lit ? words.slice(k, timing.words.length).map((w) => spokenOffsetOf(text, w)) : [],
    },
    speed,
  ).catch(() => {
    // The file went (Remove John's audio while it played) or won't open: LS-31 says so rather than the session
    // sitting silent at "playing" (review, 12 Oct 2026).
    if (activeId !== id) return;
    recording = null;
    segmentStart = null;
    set({ recorded: false });
    unavailable(useRecordings.getState().online === true ? "failed" : "offline");
  });
  updateNowPlaying();
}

/** Paused on a new verse: nothing speaks until Play, and Play starts it from its top. */
function prepareCurrent(): void {
  activeId = null;
  void Speech?.stop();
  updateNowPlaying();
}

/** `manual`: the reader's Next at a chapter's end moves on; a repeat or a stop applies only to reading on by itself. */
async function advance(manual = false): Promise<void> {
  const s = useAudio.getState().session;
  if (s === null || core === null) return;
  const { stop, repeat } = useAudio.getState();
  const step = manual
    ? ({ kind: "next" } as const)
    : stopOrRepeat({
        index: s.index,
        ords: s.verses.map((v) => v.ord),
        starts: passageStarts?.book === s.book ? passageStarts.ords : null,
        stop,
        repeat,
        now: Date.now(),
      });
  if (step.kind === "loop") {
    // LB-06: back to the loop's first verse, with the rest a passage or verse start calls for.
    set({ index: step.index, word: null });
    if (useAudio.getState().session?.status === "playing") speakCurrent();
    else prepareCurrent();
    return;
  }
  if (step.kind === "stop") {
    // LB-04: a pause at the break; the place still moves on below, so Play carries on from the next verse.
    // The setting has done its work and goes back to Off.
    pausedByInterruption = false;
    useAudio.setState({ stop: null });
    set({ status: "paused" });
  }
  const after = afterVerse(s.index, s.verses.length, s.book, s.chapter);
  if (after.kind === "verse") {
    set({ index: after.index, word: null });
  } else if (after.kind === "chapter") {
    const verses = await getChapter(asDb(core), s.book, after.chapter, s.translation);
    // Read again after the load (gate review, 11 Oct 2026): a pause or stop while it ran must not
    // be undone by the session captured before it.
    const now = useAudio.getState().session;
    if (now === null || now.book !== s.book || now.chapter !== s.chapter) return;
    if (verses.length === 0) return finish();
    useAudio.setState({ session: { ...now, chapter: after.chapter, verses, index: 0, word: null } });
    await prepareRecording(s.book, after.chapter);
    // Listen elsewhere while the recording was fetched made another session: its chapter is not this one.
    const ready = useAudio.getState().session;
    if (ready === null || ready.book !== s.book || ready.chapter !== after.chapter) return;
  } else {
    return finish();
  }
  if (useAudio.getState().session?.status !== "playing") prepareCurrent();
  else if (after.kind === "chapter") sayTitle();
  else speakCurrent();
}

/**
 * LB-08: between chapters, the new chapter's name in the reading's own voice, from the book's titles file. Without
 * that file the reading goes straight to verse 1: no other voice says it (Build 12).
 */
function sayTitle(): void {
  const s = useAudio.getState().session;
  if (s === null || Speech === null) return;
  const title = s.recorded === true && recording !== null && recording.book === s.book ? titleOnPhone(s.book, s.chapter, recording.rec.narrator) : null;
  if (title === null) {
    speakCurrent();
    return;
  }
  // No word of a verse is being spoken: the read-along pill waits for verse 1.
  spoken = null;
  set({ titling: true, word: null });
  const id = `title:${s.book}.${s.chapter}#${++counter}`;
  activeId = id;
  Speech.playSegment(id, { path: title.path, start: title.start, end: title.end, times: [], locations: [] }, useAudio.getState().speed).catch(() => {
    if (activeId !== id) return;
    set({ titling: false });
    speakCurrent();
  });
  updateNowPlaying();
}

function finish(): void {
  activeId = null;
  set({ status: "finished", word: null });
  updateNowPlaying();
}

async function switchTranslation(translation: string): Promise<void> {
  const s = useAudio.getState().session;
  // EG-03: switching the page to a licensed version keeps the BSB playing beneath it.
  const reads = audioTranslation(translation);
  if (s === null || core === null || s.translation === reads) return;
  if (reads === null) {
    pause();
    return;
  }
  translation = reads;
  const verses = await getChapter(asDb(core), s.book, s.chapter, translation);
  if (verses.length === 0) return;
  // As in advance: the session as it is now, not as it was before the load.
  const now = useAudio.getState().session;
  if (now === null || now.book !== s.book || now.chapter !== s.chapter) return;
  const at = currentVerse(now)?.verse ?? 1;
  const index = Math.max(0, verses.findIndex((v) => v.verse >= at));
  useAudio.setState({ session: { ...now, translation, verses, index, word: null } });
  // Each text has its own reading (LB-09): a switch hands over to the new text's reading.
  await prepareRecording(s.book, s.chapter);
  if (useAudio.getState().session?.status === "playing") speakCurrent();
}

function updateNowPlaying(): void {
  const s = useAudio.getState().session;
  const verse = s === null ? undefined : currentVerse(s);
  if (s === null || verse === undefined) return;
  const passage = passageStarts?.book === s.book ? (pericopeForVerse(passageStarts.rows, verse.ord)?.label ?? null) : null;
  // Real time from the recording's timings. The native side reads the player's own position; `elapsed` is the
  // fallback before it has one.
  const rec = segmentStart !== null && recording !== null ? recording.rec.timings : null;
  void Speech?.setNowPlaying({
    ...nowPlayingFor(passage, chapterTitle(s.book, s.chapter), verse.verse, s.translation),
    playing: s.status === "playing",
    ...(rec !== null && segmentStart !== null ? { elapsed: segmentStart, duration: rec.duration, rate: useAudio.getState().speed } : {}),
  });
}

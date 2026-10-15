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
 *   only way into speech, so no voice, Personal Voice included, ever reads a licensed text (rule 9).
 * - A speed or voice change takes effect at once, from the word being spoken.
 *
 * Cadence (lib/audio/cadence.ts): each verse is spoken as phrases with rests between them, and
 * rests before a verse by how the last one ended, longer at a passage and a chapter. A verse the
 * reader starts (Listen, Play from, a line, next, previous) starts at once.
 */

import { type BookCode, spokenTitle } from "@yada/schema";
import type { SQLiteDatabase } from "expo-sqlite";
import { AppState } from "react-native";

import { Speech } from "../../modules/yada-speech";
import { leadFor, pauseFor, phrasesOf, type VerseOpening } from "../lib/audio/cadence";
import { afterVerse, canSpeak, isSpeed, nowPlayingFor, rateFor } from "../lib/audio/session";
import { afterVerse as stopOrRepeat, keepStop, type Repeat, type StopChoice, stopFrom } from "../lib/audio/stop";
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
  ensureChapter,
  isRecorded,
  readText,
  type Recording,
  recordingOnPhone,
  refreshRecordings,
  setNarrator,
  titleOnPhone,
  useRecordings,
} from "./recordings";
import { loadPericopes } from "./understand";
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
/** The ords that open a passage in the session's book, for the longer rest before them. */
let passageStarts: { book: BookCode; ords: ReadonlySet<number> } | null = null;
/** The chapter recording the session is reading from, when it reads the recording (data/recordings.ts). */
let recording: { book: BookCode; chapter: number; rec: Recording } | null = null;
/** The first-play fetch under way (BA-02), so its stop can end it. */
let fetchAbort: AbortController | null = null;
/** Counts prepareRecording calls, so a call overtaken by a newer one writes nothing. */
let prepares = 0;

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
  refreshVoices();
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
        if (useAudio.getState().session?.status === "playing") speakCurrent(null, "verse");
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
    Speech.addListener("onVoiceUnavailable", () => {
      // The voice went while backgrounded: carry on from this word in the system voice.
      const s = useAudio.getState().session;
      if (s?.status === "playing") speakCurrent(s.word);
    }),
  ];
  // A voice installed in Settings while Yada is away; look again on return.
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") refreshVoices();
  });
  const unsubscribeSettings = useSettings.subscribe((now, before) => {
    if (now.translation !== before.translation) void switchTranslation(now.translation);
  });
  return () => {
    subs.forEach((s) => s.remove());
    appState.remove();
    unsubscribeSettings();
  };
}

/** The best installed system voice: whether Listen can read where there is no Heart or George. */
function refreshVoices(): void {
  if (Speech === null) return;
  useAudio.setState({ voice: Speech.voice() });
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
  // BA-02: a stop while the recording was fetched leaves the session paused; nothing starts by itself.
  const now = useAudio.getState().session;
  if (now?.status === "playing" && now.book === book && now.chapter === chapter) speakCurrent();
}

/** Headphones, the lock screen and the Live Activity's buttons (WL-02, WL-03) all come here. */
export function remoteCommand(command: string): void {
  if (command === "play") resume();
  else if (command === "pause") pause();
  else if (command === "toggle") toggle();
  else if (command === "next") next();
  else if (command === "previous") previous();
}

/** Remove my data (ST-03): the reading stops and the player goes; nothing is left to resume. */
export function endSession(): void {
  fetchAbort?.abort();
  fetchAbort = null;
  recording = null;
  activeId = null;
  void Speech?.stop();
  useAudio.setState({ session: null, stop: null, repeat: null });
}

/** LB-02: a stop at a natural break, or none. */
export function setStop(choice: StopChoice | null): void {
  useAudio.setState({ stop: choice === null ? null : stopFrom(choice, Date.now()) });
}

/** LB-05: a repeat, which clears a stop the loop would never reach (LB-07). */
export function setRepeat(repeat: Repeat | null): void {
  useAudio.setState((a) => ({ repeat, stop: keepStop(a.stop, repeat) }));
}

/** BA-02's stop: the fetch ends and the reading waits, paused, for Play. */
export function stopFetching(): void {
  fetchAbort?.abort();
  fetchAbort = null;
  pause();
}

/** What the read-along reads for a page in `translation`: itself, the BSB under a licensed one, or nothing. */
export function audioTranslation(translation: string): string | null {
  if (canSpeak(translation)) return translation;
  return isLicensedCode(translation) ? "BSB" : null;
}

/**
 * The chapter's reading by Heart or George, when it can be had (BA-02: the first play fetches it).
 * Offline with nothing saved, the iPhone voice reads and one line says why (BA-05).
 */
async function prepareRecording(book: BookCode, chapter: number): Promise<void> {
  // Only the latest call writes: Listen on another chapter while one was fetching must not get the
  // older chapter's recording when that fetch lands (review, 12 Oct 2026).
  const token = ++prepares;
  const current = () => token === prepares;
  fetchAbort?.abort();
  fetchAbort = null;
  const s = useAudio.getState().session;
  recording = null;
  if (s?.fetching !== undefined) set({ fetching: undefined });
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
    // BA-02: the first play of a chapter fetches it, with a ring that stops it.
    const abort = new AbortController();
    fetchAbort = abort;
    set({ fetching: 0 });
    rec = await ensureChapter(book, chapter, { onProgress: (share) => {
        if (current()) set({ fetching: share });
      }, signal: abort.signal }, text);
    if (!current()) return;
    fetchAbort = null;
    set({ fetching: undefined });
  }
  recording = rec === null ? null : { book, chapter, rec };
  set({ recorded: rec !== null });
  // BA-05: offline says so; online, a reading that didn't arrive says that instead, never "offline".
  if (rec === null && isRecorded(book, chapter, text)) {
    const online = useRecordings.getState().online;
    if (online !== null) useAudio.setState({ voiceNote: online ? "This reading didn’t load." : "You’re offline." });
  }
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

async function loadPassageStarts(book: BookCode): Promise<void> {
  if (passageStarts?.book === book) return;
  const pericopes = await loadPericopes(book);
  passageStarts = { book, ords: new Set(pericopes.map((p) => p.start_ord)) };
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
  const text = readText(s.translation);
  if (s.recorded !== true && text !== null && isRecorded(s.book, s.chapter, text)) {
    // BA-02: Play after a stopped fetch tries the recording again (offline, the iPhone voice reads: BA-05).
    void prepareRecording(s.book, s.chapter).then(() => {
      if (useAudio.getState().session?.status === "playing") speakCurrent(useAudio.getState().session?.word ?? null);
    });
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

/** AVSpeechUtterance cannot change rate or voice mid-utterance, so the verse restarts at the word being spoken. */
function restartAtWord(): void {
  const s = useAudio.getState().session;
  if (s?.status === "playing") speakCurrent(s.word);
}

/** Speak the current verse, from `fromWord` when resuming mid-verse, after the rest `opening` calls for. */
function speakCurrent(fromWord: WordRange | null = null, opening: VerseOpening = "start"): void {
  const s = useAudio.getState().session;
  const verse = s === null ? undefined : currentVerse(s);
  if (s === null || verse === undefined || Speech === null || !canSpeak(s.translation)) return;
  // A verse speaking ends the chapter's name: a speed or voice change during the name otherwise left the player
  // showing the title over verse 1 for the whole chapter (review, 15 Oct 2026).
  if (s.titling === true) set({ titling: false });
  const { speed } = useAudio.getState();
  const text = spokenFor(verse.text);
  const from = fromWord === null ? 0 : spokenOffsetOf(text, fromWord);
  spoken = { text, words: wordRanges(verse.text) };
  // The recording reads the session's own text only: its timings fit that text's words (LB-09).
  if (s.recorded === true && recording !== null && recording.rec.text === s.translation && recording.book === s.book && recording.chapter === s.chapter) {
    const timing = recording.rec.timings.verses.find((t) => t.verse === verse.verse);
    // Timings built from another edition of the text would light the wrong words: that verse goes to
    // the iPhone voice instead (review, 12 Oct 2026).
    if (timing !== undefined && timing.words.length === spoken.words.length) {
      const words = spoken.words;
      // Word k of the text has time k (both are the verse's words split at spaces); the pill follows them.
      const k = fromWord === null ? 0 : Math.max(0, words.findIndex((w) => w.start === fromWord.start));
      const id = `${s.book}.${s.chapter}.${verse.verse}#${++counter}`;
      activeId = id;
      Speech.playSegment(
        id,
        {
          path: recording.rec.path,
          start: timing.words[k] ?? timing.start,
          end: timing.end,
          times: timing.words.slice(k),
          locations: words.slice(k, timing.words.length).map((w) => spokenOffsetOf(text, w)),
        },
        speed,
      ).catch(() => {
        // The file went (Remove John's audio while it played) or won't open: the iPhone voice reads on
        // rather than the session sitting silent at "playing" (review, 12 Oct 2026).
        if (activeId !== id) return;
        recording = null;
        set({ recorded: false });
        if (useAudio.getState().session?.status === "playing") speakCurrent(fromWord);
      });
      updateNowPlaying();
      return;
    }
  }
  const before = s.verses[s.index - 1];
  const lead = pauseFor(leadFor(opening, before === undefined ? null : spokenFor(before.text).text), speed);
  const phrases = phrasesOf(text.text, from).map((p) => ({
    text: text.text.slice(p.start, p.end),
    offset: p.start,
    pause: pauseFor(p.pause, speed),
  }));
  activeId = `${s.book}.${s.chapter}.${verse.verse}#${++counter}`;
  void Speech.speak(activeId, phrases, rateFor(speed), lead, null);
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
    if (useAudio.getState().session?.status === "playing") speakCurrent(null, step.index === s.index ? "verse" : "passage");
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
  let opening: VerseOpening;
  if (after.kind === "verse") {
    set({ index: after.index, word: null });
    const ord = s.verses[after.index]?.ord;
    opening = ord !== undefined && passageStarts?.book === s.book && passageStarts.ords.has(ord) ? "passage" : "verse";
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
    opening = "chapter";
  } else {
    return finish();
  }
  if (useAudio.getState().session?.status !== "playing") prepareCurrent();
  else if (after.kind === "chapter") sayTitle();
  else speakCurrent(null, opening);
}

/**
 * LB-08: between chapters, the new chapter's name in the reading's own voice, from the book's titles file;
 * where no recording reads, or the file is not on the phone, the iPhone voice says the same words.
 */
function sayTitle(): void {
  const s = useAudio.getState().session;
  if (s === null || Speech === null) return;
  const { speed } = useAudio.getState();
  // No word of a verse is being spoken: the read-along pill waits for verse 1.
  spoken = null;
  set({ titling: true, word: null });
  const id = `title:${s.book}.${s.chapter}#${++counter}`;
  activeId = id;
  const say = () =>
    void Speech?.speak(id, [{ text: spokenTitle(s.book, s.chapter), offset: 0, pause: 0 }], rateFor(speed), pauseFor(leadFor("chapter", null), speed), null);
  const title = s.recorded === true && recording !== null && recording.book === s.book ? titleOnPhone(s.book, s.chapter, recording.rec.narrator) : null;
  if (title === null) say();
  else
    Speech.playSegment(id, { path: title.path, start: title.start, end: title.end, times: [], locations: [] }, speed).catch(() => {
      if (activeId === id) say();
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
  // Each text has its own reading (LB-09): a switch hands over to the new text's reading where the book has
  // one, else to the iPhone voice, and back again on the way back.
  await prepareRecording(s.book, s.chapter);
  if (useAudio.getState().session?.status === "playing") speakCurrent();
}

function updateNowPlaying(): void {
  const s = useAudio.getState().session;
  const verse = s === null ? undefined : currentVerse(s);
  if (s === null || verse === undefined) return;
  void Speech?.setNowPlaying({ ...nowPlayingFor(chapterTitle(s.book, s.chapter), s.translation, verse.verse), playing: s.status === "playing" });
}

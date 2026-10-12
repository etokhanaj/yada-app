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

import type { BookCode } from "@yada/schema";
import type { SQLiteDatabase } from "expo-sqlite";
import { AppState } from "react-native";

import { Speech } from "../../modules/yada-speech";
import { leadFor, pauseFor, phrasesOf, type VerseOpening } from "../lib/audio/cadence";
import { afterVerse, canSpeak, isSpeed, nowPlayingFor, rateFor } from "../lib/audio/session";
import { type SpokenText, spokenFor, spokenOffsetOf, wordAt, type WordRange, wordRanges } from "../lib/audio/text";
import { CLEARER_VOICE_HINT, effectiveChoice, isVoiceChoice, PERSONAL_VOICE_HINT, type VoiceChoice } from "../lib/audio/voice";
import { chapterTitle } from "../lib/reader";
import { type AudioSession, currentVerse, useAudio } from "../state/audio";
import { useSettings } from "../state/settings";
import { asDb } from "./AppData";
import { getChapter } from "./queries";
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
/** What the reader picked in the menu, as stored; voiceChoice in the store is what really speaks. */
let picked: VoiceChoice = "system";

const set = (patch: Partial<AudioSession>) => {
  const s = useAudio.getState().session;
  if (s !== null) useAudio.setState({ session: { ...s, ...patch } });
};

/** Once, from the root layout after the databases open. Returns the unsubscribe. */
export function initAudio(coreDb: SQLiteDatabase, userDb: SQLiteDatabase, stored: Record<string, string>): () => void {
  core = coreDb;
  user = userDb;
  const speed = Number(stored["audioSpeed"]);
  const choice = stored["audioVoice"];
  picked = isVoiceChoice(choice) ? choice : "system";
  useAudio.setState({
    speed: isSpeed(speed) ? speed : 1,
    voiceHintSeen: stored["voiceHintSeen"] === "1",
  });
  refreshVoices();
  if (Speech === null) return () => undefined;
  const subs = [
    Speech.addListener("onRange", ({ id, location }) => {
      if (id !== activeId || spoken === null) return;
      const i = wordAt(spoken.words, spoken.text, location);
      if (i !== null) set({ word: spoken.words[i] ?? null });
    }),
    Speech.addListener("onFinish", ({ id }) => {
      if (id === activeId) void advance();
    }),
    Speech.addListener("onRemote", ({ command }) => {
      if (command === "play") resume();
      else if (command === "pause") pause();
      else if (command === "toggle") toggle();
      else if (command === "next") next();
      else previous();
    }),
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
      // Backgrounded mid-verse in the Personal Voice: carry on from this word in the system voice.
      const s = useAudio.getState().session;
      if (s?.status === "playing") speakCurrent(s.word);
    }),
  ];
  // The reader can revoke Personal Voice in Settings while Yada is away; look again on return.
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

/**
 * Read the installed voices and Personal Voice's status, without ever asking for it. A Personal
 * Voice that was chosen and is now denied (revoked in Settings) falls back to the system voice,
 * silently, and the fallback is stored so the menu and the voice agree.
 */
function refreshVoices(): void {
  if (Speech === null) return;
  const personalStatus = Speech.personalVoiceStatus();
  const personalVoice = Speech.personalVoice();
  const voiceChoice = effectiveChoice(picked, personalStatus, personalVoice);
  if (picked === "personal" && personalStatus === "denied") storeChoice("system");
  useAudio.setState({ voice: Speech.voice(), personalStatus, personalVoice, voiceChoice });
}

function storeChoice(choice: VoiceChoice): void {
  picked = choice;
  if (user !== null) void saveSetting(user, "audioVoice", choice);
}

/** Listen and Play from: read `book` `chapter` from `verse` in the reader's translation. */
export async function listen(book: BookCode, chapter: number, verse: number): Promise<void> {
  const translation = useSettings.getState().translation;
  if (core === null || !canSpeak(translation)) return;
  const verses = await getChapter(asDb(core), book, chapter, translation);
  if (verses.length === 0) return;
  const index = Math.max(0, verses.findIndex((v) => v.verse >= verse));
  useAudio.setState({ session: { book, chapter, translation, verses, index, word: null, status: "playing" } });
  void loadPassageStarts(book);
  speakCurrent();
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
  set({ index, word: null, status: "playing" });
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
  set({ status: "playing" });
  updateNowPlaying();
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
  if (s.index + 1 < s.verses.length) {
    set({ index: s.index + 1, word: null, status: s.status === "finished" ? "playing" : s.status });
    if (useAudio.getState().session?.status === "playing") speakCurrent();
    else prepareCurrent();
  } else {
    void advance();
  }
}

export function previous(): void {
  const s = useAudio.getState().session;
  if (s === null) return;
  set({ index: Math.max(0, s.index - 1), word: null, status: s.status === "finished" ? "playing" : s.status });
  if (useAudio.getState().session?.status === "playing") speakCurrent();
  else prepareCurrent();
}

export function setSpeed(speed: number): void {
  if (!isSpeed(speed) || speed === useAudio.getState().speed) return;
  useAudio.setState({ speed });
  if (user !== null) void saveSetting(user, "audioSpeed", String(speed));
  restartAtWord();
}

/**
 * The menu's voice rows. Personal Voice asks for authorization here and only here, the first
 * time; a denial leaves the system voice chosen and shows where the switch lives.
 */
export async function chooseVoice(choice: VoiceChoice): Promise<void> {
  if (Speech === null) return;
  if (choice === "personal" && Speech.personalVoiceStatus() === "notDetermined") {
    await Speech.requestPersonalVoice();
  }
  const before = useAudio.getState().voiceChoice;
  picked = choice;
  refreshVoices();
  const now = useAudio.getState();
  // Denied, or authorized with no voice made: the system voice stays, and the stored choice says so.
  storeChoice(now.voiceChoice);
  if (choice === "personal" && now.personalStatus === "denied") useAudio.setState({ voiceNote: PERSONAL_VOICE_HINT });
  if (now.voiceChoice !== before) restartAtWord();
}

/** "Get a clearer voice": the AU-07 line, on demand. */
export function showClearerVoice(): void {
  useAudio.setState({ voiceNote: CLEARER_VOICE_HINT });
}

export function markVoiceHintSeen(): void {
  if (useAudio.getState().voiceHintSeen) return;
  useAudio.setState({ voiceHintSeen: true });
  if (user !== null) void saveSetting(user, "voiceHintSeen", "1");
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
  const { speed, voiceChoice, personalVoice } = useAudio.getState();
  const text = spokenFor(verse.text);
  const from = fromWord === null ? 0 : spokenOffsetOf(text, fromWord);
  spoken = { text, words: wordRanges(verse.text) };
  const before = s.verses[s.index - 1];
  const lead = pauseFor(leadFor(opening, before === undefined ? null : spokenFor(before.text).text), speed);
  const phrases = phrasesOf(text.text, from).map((p) => ({
    text: text.text.slice(p.start, p.end),
    offset: p.start,
    pause: pauseFor(p.pause, speed),
  }));
  activeId = `${s.book}.${s.chapter}.${verse.verse}#${++counter}`;
  const voiceId = voiceChoice === "personal" ? (personalVoice?.id ?? null) : null;
  void Speech.speak(activeId, phrases, rateFor(speed), lead, voiceId);
  updateNowPlaying();
}

/** Paused on a new verse: nothing speaks until Play, and Play starts it from its top. */
function prepareCurrent(): void {
  activeId = null;
  void Speech?.stop();
  updateNowPlaying();
}

async function advance(): Promise<void> {
  const s = useAudio.getState().session;
  if (s === null || core === null) return;
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
    opening = "chapter";
  } else {
    return finish();
  }
  if (useAudio.getState().session?.status === "playing") speakCurrent(null, opening);
  else prepareCurrent();
}

function finish(): void {
  activeId = null;
  set({ status: "finished", word: null });
  updateNowPlaying();
}

async function switchTranslation(translation: string): Promise<void> {
  const s = useAudio.getState().session;
  if (s === null || core === null || s.translation === translation) return;
  if (!canSpeak(translation)) {
    pause();
    return;
  }
  const verses = await getChapter(asDb(core), s.book, s.chapter, translation);
  if (verses.length === 0) return;
  // As in advance: the session as it is now, not as it was before the load.
  const now = useAudio.getState().session;
  if (now === null || now.book !== s.book || now.chapter !== s.chapter) return;
  const at = currentVerse(now)?.verse ?? 1;
  const index = Math.max(0, verses.findIndex((v) => v.verse >= at));
  useAudio.setState({ session: { ...now, translation, verses, index, word: null } });
  if (now.status === "playing") speakCurrent();
}

function updateNowPlaying(): void {
  const s = useAudio.getState().session;
  const verse = s === null ? undefined : currentVerse(s);
  if (s === null || verse === undefined) return;
  void Speech?.setNowPlaying({ ...nowPlayingFor(chapterTitle(s.book, s.chapter), s.translation, verse.verse), playing: s.status === "playing" });
}

/**
 * The read-along's state: what is being read and where. In memory only, so a killed app comes
 * back to the reader at its saved position with nothing playing (coordinator, 11 Oct 2026).
 * Speed, the voice choice and the voice hint persist per device through user.db (data/audio.ts);
 * none of them is in lib/cloudSync.ts SYNCED_SETTINGS, so they never reach iCloud: a voice
 * installed on one phone may not exist on the next.
 */

import type { BookCode } from "@yada/schema";
import { create } from "zustand";

import type { VerseText } from "../data/queries";
import type { WordRange } from "../lib/audio/text";
import type { PersonalVoiceStatus, Voice } from "../../modules/yada-speech";
import type { VoiceChoice } from "../lib/audio/voice";

export type PlayStatus = "playing" | "paused" | "finished";

export interface AudioSession {
  readonly book: BookCode;
  readonly chapter: number;
  /** The text being read, which can differ from the reader's after a switch to a licensed version. */
  readonly translation: string;
  readonly verses: readonly VerseText[];
  readonly index: number;
  /** The drawn word being spoken, in the current verse's display text. */
  readonly word: WordRange | null;
  readonly status: PlayStatus;
}

interface AudioState {
  session: AudioSession | null;
  speed: number;
  /** The best system voice. Null: no English voice installed, so Listen is hidden. */
  voice: Voice | null;
  /** The reader's choice as it really speaks (lib/audio/voice.ts effectiveChoice), per device. */
  voiceChoice: VoiceChoice;
  personalStatus: PersonalVoiceStatus;
  /** The reader's Personal Voice, when authorized and one has been made. */
  personalVoice: Voice | null;
  /** The basic-voice line (AU-07) has been shown once. */
  voiceHintSeen: boolean;
  /** A Settings line the reader asked for from the menu, shown under the player's title. */
  voiceNote: string | null;
}

export const useAudio = create<AudioState>(() => ({
  session: null,
  speed: 1,
  voice: null,
  voiceChoice: "system",
  personalStatus: "unsupported",
  personalVoice: null,
  voiceHintSeen: false,
  voiceNote: null,
}));

export function currentVerse(session: AudioSession): VerseText | undefined {
  return session.verses[session.index];
}

/**
 * One verse's read-along mark as a string, so a row re-renders only when its own mark changes:
 * "" (not playing here, or already read), "u" (still to come), "c" (started, no word yet) or
 * "c:start:end" (the word being spoken).
 */
export function markKey(state: AudioState, book: BookCode, chapter: number, translation: string, verse: number): string {
  const s = state.session;
  if (s === null || s.book !== book || s.chapter !== chapter || s.translation !== translation || s.status === "finished") return "";
  const now = s.verses[s.index]?.verse ?? 0;
  if (verse < now) return "";
  if (verse > now) return "u";
  return s.word === null ? "c" : `c:${s.word.start}:${s.word.end}`;
}

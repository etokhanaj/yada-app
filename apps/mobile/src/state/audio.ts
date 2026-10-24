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
import type { Repeat, Stop } from "../lib/audio/stop";
import type { WordRange } from "../lib/audio/text";
import type { Voice } from "../../modules/yada-speech";

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
  /** Read by the human recording (BA-01), not the iPhone voice. */
  readonly recorded?: boolean;
  /** The chapter's name is being said before its first verse (build 6, LB-08). */
  readonly titling?: boolean;
  /**
   * ST-01, ST-02: the chapter streams on its first play and is waiting for bytes; the play control shows a spinner.
   * It replaced BA-02's wait behind a download ring (John, 23 Oct 2026).
   */
  readonly buffering?: boolean;
}

interface AudioState {
  session: AudioSession | null;
  speed: number;
  /** The best system voice, which reads where there is no reading by Heart or George. Null: no English voice installed, so Listen is hidden there. */
  voice: Voice | null;
  /** "You're offline." under the player's title, when a reading couldn't be had (BA-05). */
  voiceNote: string | null;
  /** LB-02: where the reading stops on its own; back to null once it has. */
  stop: Stop | null;
  /** LB-05: what loops, for memorising. */
  repeat: Repeat | null;
}

export const useAudio = create<AudioState>(() => ({
  session: null,
  speed: 1,
  voice: null,
  voiceNote: null,
  stop: null,
  repeat: null,
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

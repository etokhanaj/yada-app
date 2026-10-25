/**
 * The JS face of modules/yada-speech: the recordings a verse at a time, Now Playing, remote commands, the breath's
 * haptics and rain. Apple's speech synthesis was removed in Build 12: every verse is read from a recording.
 *
 * Optional, not required: a build without the native module (an old dev client, the web
 * target) gets null, and the reader then hides Listen rather than crashing.
 */

import { type EventSubscription, requireOptionalNativeModule } from "expo-modules-core";

/** A verse of a chapter recording: where it is, and when and where each word falls (data/recordings.ts). */
export interface RecordedSegment {
  /** A saved file's path, or the chapter's https URL while it streams the first time (ios/StreamLoader.swift). */
  readonly path: string;
  /** Streaming only: where the bytes are saved as they arrive, and the file's size from the manifest. */
  readonly savePath?: string;
  readonly bytes?: number;
  readonly start: number;
  readonly end: number;
  readonly times: readonly number[];
  readonly locations: readonly number[];
}

export type RemoteCommand = "play" | "pause" | "toggle" | "next" | "previous";

export interface SpeechEvents {
  onStart: (e: { id: string }) => void;
  /** `location` is the word's offset in the verse's spoken form, as the segment's `locations` gave it. */
  onRange: (e: { id: string; location: number; length: number }) => void;
  onFinish: (e: { id: string }) => void;
  onRemote: (e: { command: RemoteCommand }) => void;
  onInterruption: (e: { began: boolean; shouldResume: boolean }) => void;
  onRouteLost: (e: Record<string, never>) => void;
  /** A streaming chapter is waiting for bytes (true) or playing again (false). */
  onBuffering: (e: { waiting: boolean }) => void;
  /** Every byte of a streamed chapter arrived and is at `savePath`, not yet checked. */
  onStreamSaved: (e: { url: string; savePath: string }) => void;
  /** The connection dropped mid-chapter; nothing was kept. */
  onStreamFailed: (e: { url: string; savePath: string }) => void;
}

interface NativeSpeech {
  /** One verse of a recording: onStart, onRange for each word and onFinish arrive with `id`. */
  playSegment(id: string, segment: RecordedSegment, rate: number): Promise<void>;
  pause(): Promise<void>;
  /** False when nothing was paused mid-verse: the caller plays the verse again from its start. */
  resume(): Promise<boolean>;
  stop(): Promise<void>;
  /** AS-01: a quiet looped sound, faded in; stopAmbient fades it out. */
  playAmbient(uri: string, volume: number): Promise<void>;
  stopAmbient(): Promise<void>;
  /** BR-01 to BR-03: the breath's haptic. "in" over `seconds`, "out" one firm tap; false where it can't play. */
  breathe(phase: "in" | "out", seconds: number): Promise<boolean>;
  stopBreathing(): Promise<void>;
  /** `elapsed` and `duration` in seconds, from a recording's timings; `rate` is the reading speed. */
  setNowPlaying(info: { title: string; artist: string; playing: boolean; elapsed?: number; duration?: number; rate?: number }): Promise<void>;
  clearNowPlaying(): Promise<void>;
  addListener<E extends keyof SpeechEvents>(event: E, listener: SpeechEvents[E]): EventSubscription;
}

export const Speech: NativeSpeech | null = requireOptionalNativeModule<NativeSpeech>("YadaSpeech");

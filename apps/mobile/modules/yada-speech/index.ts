/**
 * The JS face of modules/yada-speech (AVSpeechSynthesizer, Now Playing, remote commands).
 * See ios/YadaSpeechModule.swift for why this is not expo-speech.
 *
 * Optional, not required: a build without the native module (an old dev client, the web
 * target) gets null, and the reader then hides Listen rather than crashing.
 */

import { type EventSubscription, requireOptionalNativeModule } from "expo-modules-core";

export type VoiceQuality = "premium" | "enhanced" | "default";

export interface Voice {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly quality: VoiceQuality;
}

/** AVSpeechSynthesizer.PersonalVoiceAuthorizationStatus; "unsupported" before iOS 17 and in the Simulator. */
export type PersonalVoiceStatus = "unsupported" | "notDetermined" | "denied" | "authorized";

/** One utterance of a verse (lib/audio/cadence.ts): its text, its offset in the spoken form, the rest after it. */
export interface SpokenPhrase {
  readonly text: string;
  readonly offset: number;
  readonly pause: number;
}

/** A verse of a chapter recording: where it is, and when and where each word falls (data/recordings.ts). */
export interface RecordedSegment {
  readonly path: string;
  readonly start: number;
  readonly end: number;
  readonly times: readonly number[];
  readonly locations: readonly number[];
}

export type RemoteCommand = "play" | "pause" | "toggle" | "next" | "previous";

export interface SpeechEvents {
  onStart: (e: { id: string }) => void;
  /** `location` is an offset into the verse's whole spoken form, the phrase's offset already added. */
  onRange: (e: { id: string; location: number; length: number }) => void;
  onFinish: (e: { id: string }) => void;
  onCancel: (e: { id: string }) => void;
  onRemote: (e: { command: RemoteCommand }) => void;
  onInterruption: (e: { began: boolean; shouldResume: boolean }) => void;
  onRouteLost: (e: Record<string, never>) => void;
  /** The app went to the background while a verse played in the Personal Voice. */
  onVoiceUnavailable: (e: Record<string, never>) => void;
}

interface NativeSpeech {
  /** The best installed English system voice. */
  voice(): Voice | null;
  personalVoiceStatus(): PersonalVoiceStatus;
  /** Shows the system prompt the first time; afterwards answers with the stored status. */
  requestPersonalVoice(): Promise<PersonalVoiceStatus>;
  /** The reader's Personal Voice, when authorized and one exists. */
  personalVoice(): Voice | null;
  /** `voiceId` null speaks in voice(); a Personal Voice is used only while authorized and in the foreground. */
  speak(id: string, phrases: readonly SpokenPhrase[], rate: number, lead: number, voiceId: string | null): Promise<void>;
  /** One verse of a human-read recording; events arrive as for speak, with the same id. */
  playSegment(id: string, segment: RecordedSegment, rate: number): Promise<void>;
  pause(): Promise<void>;
  /** False when nothing was paused mid-utterance (paused between verses), or a Personal Voice verse is resumed in the background. */
  resume(): Promise<boolean>;
  stop(): Promise<void>;
  /** AS-01: a quiet looped sound, faded in; stopAmbient fades it out. */
  playAmbient(uri: string, volume: number): Promise<void>;
  stopAmbient(): Promise<void>;
  setNowPlaying(info: { title: string; artist: string; playing: boolean }): Promise<void>;
  clearNowPlaying(): Promise<void>;
  addListener<E extends keyof SpeechEvents>(event: E, listener: SpeechEvents[E]): EventSubscription;
}

export const Speech: NativeSpeech | null = requireOptionalNativeModule<NativeSpeech>("YadaSpeech");

/**
 * The player's speed-and-voice menu, pure so it can be tested: what it offers, how each row
 * reads, and which voice a choice really gets.
 *
 * Personal Voice (iOS 17+) is opt-in and asked for only when the reader picks it here, never at
 * launch. When it is denied, revoked or not made yet, the system voice is shown as chosen and
 * speaks, without an error: the reader asked for a voice, not for a problem to solve.
 */

import type { PersonalVoiceStatus, Voice } from "../../../modules/yada-speech";
import { SPEEDS, speedAccessibilityLabel, speedLabel } from "./session";

export type VoiceChoice = "system" | "personal";

export const PERSONAL_VOICE = "Your Personal Voice";
export const CLEARER_VOICE = "Get a clearer voice";

/** The AU-07 line, also shown on demand from the menu: iOS cannot open that Settings page from an app. */
export const CLEARER_VOICE_HINT = "For a clearer voice: Settings › Accessibility › Spoken Content › Voices.";
/** After a denied request: where iOS keeps the per-app switch (Settings › Accessibility › Personal Voice). */
export const PERSONAL_VOICE_HINT = "To use your Personal Voice: Settings › Accessibility › Personal Voice.";

export function isVoiceChoice(value: string | undefined): value is VoiceChoice {
  return value === "system" || value === "personal";
}

/** "Ava (Premium)", "Daniel (Enhanced)", "Samantha": as Settings › Spoken Content › Voices names them. */
export function voiceLabel(voice: Voice): string {
  if (voice.quality === "premium") return `${voice.name} (Premium)`;
  if (voice.quality === "enhanced") return `${voice.name} (Enhanced)`;
  return voice.name;
}

/**
 * The Personal Voice row shows wherever the device can have one: not on an unsupported device,
 * and not once authorized with no voice made (there is nothing to pick). Undetermined and denied
 * still show it, since asking (or the Settings line) is how the reader gets there.
 */
export function offersPersonalVoice(status: PersonalVoiceStatus, personal: Voice | null): boolean {
  if (status === "unsupported") return false;
  return !(status === "authorized" && personal === null);
}

/** The choice that really speaks: Personal Voice only while it is authorized and exists. */
export function effectiveChoice(choice: VoiceChoice, status: PersonalVoiceStatus, personal: Voice | null): VoiceChoice {
  return choice === "personal" && status === "authorized" && personal !== null ? "personal" : "system";
}

/** A clearer voice is worth offering until the best one installed is Premium. */
export function offersClearerVoice(system: Voice | null): boolean {
  return system !== null && system.quality !== "premium";
}

/** VoiceOver for the menu button: "Speed, 1 times. Voice, Samantha". */
export function menuAccessibilityLabel(speed: number, voiceName: string | null): string {
  const s = speedAccessibilityLabel(speed);
  return voiceName === null ? s : `${s}. Voice, ${voiceName}`;
}

export interface MenuRow {
  readonly id: string;
  readonly title: string;
  readonly on: boolean;
}

export interface MenuSection {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly MenuRow[];
}

/** Speed, then Voice: the system voice, Your Personal Voice, Get a clearer voice. */
export function playerMenu(
  speed: number,
  system: Voice | null,
  choice: VoiceChoice,
  personalOffered: boolean,
  clearerOffered: boolean,
): MenuSection[] {
  const speeds: MenuRow[] = SPEEDS.map((s) => ({ id: `speed:${s}`, title: speedLabel(s), on: s === speed }));
  const voices: MenuRow[] = [];
  if (system !== null) voices.push({ id: "voice:system", title: voiceLabel(system), on: choice === "system" });
  if (personalOffered) voices.push({ id: "voice:personal", title: PERSONAL_VOICE, on: choice === "personal" });
  if (clearerOffered) voices.push({ id: "voice:clearer", title: CLEARER_VOICE, on: false });
  return [
    { id: "speed", title: "Speed", rows: speeds },
    { id: "voice", title: "Voice", rows: voices },
  ];
}

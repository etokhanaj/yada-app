/**
 * A quiet sound under prayer (AS-01; John, 17 Oct 2026: "an easy way they can opt in or out"). Off until tapped,
 * never autoplay, never remembered between sessions: each prayer starts in silence. Rain from pdsounds.org via
 * Wikimedia Commons ("Rain (1).ogg" by ezwa, public domain per its file page), its last two seconds crossfaded into
 * its first so the loop has no seam, at -30 LUFS under any voice (content/raw/ambient).
 */

import { Image } from "react-native";
import { create } from "zustand";

import { Speech } from "../../modules/yada-speech";

const RAIN = require("../../assets/sound-rain.m4a") as number;

export const useAmbient = create<{ readonly on: boolean }>(() => ({ on: false }));

export async function setAmbient(on: boolean): Promise<void> {
  useAmbient.setState({ on });
  if (Speech === null) return;
  if (on) await Speech.playAmbient(Image.resolveAssetSource(RAIN).uri, 0.5);
  else await Speech.stopAmbient();
}

/**
 * @yada/mobile — STUB.
 *
 * Will become the Expo React Native reader (build plan §6). No app code is
 * written until the Milestone 0 pipeline proof passes; this package exists so
 * the workspace shape is settled.
 */

import type { VerseId } from "@yada/schema";

/** The three depths of one reading surface (design brief). */
export const APP_DEPTHS = ["read", "understand", "evidence"] as const;
export type AppDepth = (typeof APP_DEPTHS)[number];

/** Back-to-reading anchors by verse id, never by pixel offset. */
export interface ReadingPosition {
  verse_id: VerseId;
}

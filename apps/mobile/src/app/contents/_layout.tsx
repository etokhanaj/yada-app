/**
 * Contents (canvas C-01, C-02): books, then a book's chapters pushed inside
 * the same sheet. Opened from the reader's title; from Home a book opens
 * straight at its chapters.
 */

import { Stack } from "expo-router";

import { useReduceMotion } from "../../lib/motion";

import { usePalette } from "../../design/tokens";

export default function ContentsLayout() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  // Reduce Motion: pages inside the sheet fade in place of sliding (QA, 13 Oct 2026).
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.sheet }, animation: reduceMotion ? "fade" : "default" }} />;
}

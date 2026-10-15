/**
 * The Understand sheet's own stack: Passage and `More on 14:34` push inside
 * it, so the reader is never more than two sheets deep (brief §1 rule 2).
 */

import { Stack } from "expo-router";

import { useReduceMotion } from "../../lib/motion";

import { usePalette } from "../../design/tokens";

export default function UnderstandLayout() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  // Reduce Motion: pages inside the sheet fade in place of sliding (QA, 13 Oct 2026).
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.sheet }, animation: reduceMotion ? "fade" : "default" }} />;
}

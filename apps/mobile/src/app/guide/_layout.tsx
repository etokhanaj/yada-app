/**
 * The passage guide's own stack (PG-04): a verse's Understand pushes inside
 * the guide, ‹ back to it, so the evidence sheet is still only the second
 * sheet (brief §1 rule 2).
 */

import { Stack } from "expo-router";

import { useReduceMotion } from "../../lib/motion";

import { usePalette } from "../../design/tokens";

export default function GuideLayout() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  // Reduce Motion: pages inside the sheet fade in place of sliding (QA, 13 Oct 2026).
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.sheet }, animation: reduceMotion ? "fade" : "default" }} />;
}

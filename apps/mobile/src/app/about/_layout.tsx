/** About a book's own stack (OR-04, OR-07): places and people push inside the sheet, ‹ back to About. */

import { Stack } from "expo-router";

import { useReduceMotion } from "../../lib/motion";

import { usePalette } from "../../design/tokens";

export default function AboutLayout() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  // Reduce Motion: pages inside the sheet fade in place of sliding (QA, 13 Oct 2026).
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.sheet }, animation: reduceMotion ? "fade" : "default" }} />;
}

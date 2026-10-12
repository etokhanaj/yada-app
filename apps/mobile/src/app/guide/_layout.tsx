/**
 * The passage guide's own stack (PG-04): a verse's Understand pushes inside
 * the guide, ‹ back to it, so the evidence sheet is still only the second
 * sheet (brief §1 rule 2).
 */

import { Stack } from "expo-router";

import { usePalette } from "../../design/tokens";

export default function GuideLayout() {
  const palette = usePalette();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.sheet } }} />;
}

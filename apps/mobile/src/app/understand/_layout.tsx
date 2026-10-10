/**
 * The Understand sheet's own stack: Passage and `More on 14:34` push inside
 * it, so the reader is never more than two sheets deep (brief §1 rule 2).
 */

import { Stack } from "expo-router";

import { usePalette } from "../../design/tokens";

export default function UnderstandLayout() {
  const palette = usePalette();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.sheet } }} />;
}

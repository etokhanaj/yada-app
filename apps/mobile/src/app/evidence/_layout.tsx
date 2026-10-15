/**
 * The evidence sheet (depth 2) and its own stack: Why we say this → the word →
 * its occurrences push inside it, and `×` closes the whole sheet back to
 * Understand. Never a third sheet (brief §1 rule 2; Phase 2 spike, 9 Oct:
 * stacked formSheets with a nested stack held on react-native-screens 4.26).
 */

import { Stack } from "expo-router";

import { useReduceMotion } from "../../lib/motion";

import { usePalette } from "../../design/tokens";

export default function EvidenceLayout() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  // Reduce Motion: pages inside the sheet fade in place of sliding (QA, 13 Oct 2026).
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.sheet }, animation: reduceMotion ? "fade" : "default" }} />;
}

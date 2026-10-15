/**
 * The passage guide (build plan Phase 2; canvas NA-04, JR-05): one sheet per passage, opened from the
 * reader's passage title, Home and the player. Its body is components/PassageGuide.tsx, shared with
 * Understand on a range.
 */

import { useLocalSearchParams } from "expo-router";

import { PassageGuide } from "../../components/PassageGuide";
import { resolveRef } from "../../lib/chapters";

export default function GuideScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const span = resolveRef(params.ref ?? "");
  if (span === null) return null;
  return <PassageGuide key={params.ref} book={span.book} startOrd={span.startOrd} endOrd={span.endOrd} />;
}

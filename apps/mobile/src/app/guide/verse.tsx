import { router, useLocalSearchParams } from "expo-router";

import { UnderstandRoute } from "../../components/UnderstandViews";

/**
 * A verse of the passage, its Understand pushed inside the guide (PG-04): ‹ goes back to the guide,
 * and so does its passage row, since the guide is that passage.
 */
export default function GuideVerse() {
  const params = useLocalSearchParams<{ ref?: string; passage?: string }>();
  return <UnderstandRoute refText={params.ref ?? ""} subtitle={params.passage === "" ? undefined : params.passage} onPassage={() => router.back()} inGuide />;
}

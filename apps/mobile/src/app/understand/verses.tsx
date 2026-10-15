import { useLocalSearchParams } from "expo-router";

import { VersesPage } from "../../components/UnderstandPages";

/** Verse by verse, from the passage guide's More (UX-09). */
export default function Page() {
  const params = useLocalSearchParams<{ ref?: string; term?: string }>();
  return <VersesPage refText={params.ref ?? ""} />;
}

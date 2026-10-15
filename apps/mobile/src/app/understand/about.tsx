import { useLocalSearchParams } from "expo-router";

import { AboutPsalmPage } from "../../components/UnderstandPages";

/** About this psalm, from the passage guide's More (JR-03). */
export default function Page() {
  const params = useLocalSearchParams<{ ref?: string; term?: string }>();
  return <AboutPsalmPage refText={params.ref ?? ""} />;
}

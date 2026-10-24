import { useLocalSearchParams } from "expo-router";

import { InShortPage } from "../../components/UnderstandPages";

/** In short, from the passage guide's Go deeper (RU-3). */
export default function Page() {
  const params = useLocalSearchParams<{ ref?: string }>();
  return <InShortPage refText={params.ref ?? ""} />;
}

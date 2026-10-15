import { useLocalSearchParams } from "expo-router";

import { CheckPage } from "../../components/UnderstandPages";

/** Check what you read: Translation Questions for a verse or a passage. */
export default function Page() {
  const params = useLocalSearchParams<{ ref?: string; term?: string }>();
  return <CheckPage refText={params.ref ?? ""} />;
}

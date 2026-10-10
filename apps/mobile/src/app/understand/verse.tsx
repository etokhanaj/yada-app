import { useLocalSearchParams } from "expo-router";

import { UnderstandRoute } from "../../components/UnderstandViews";

/** `More on 14:34` from a passage, pushed inside the Understand sheet. */
export default function Verse() {
  const params = useLocalSearchParams<{ ref?: string }>();
  return <UnderstandRoute refText={params.ref ?? ""} />;
}

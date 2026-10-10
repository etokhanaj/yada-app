import { useLocalSearchParams } from "expo-router";

import { UnderstandRoute } from "../../components/UnderstandViews";

/** A verse's passage, pushed inside the Understand sheet. */
export default function Passage() {
  const params = useLocalSearchParams<{ ref?: string }>();
  return <UnderstandRoute refText={params.ref ?? ""} />;
}

import { useLocalSearchParams } from "expo-router";

import { UnderstandRoute } from "../../components/UnderstandViews";

/** A verse of a passage or a selection, its Understand pushed inside the same sheet. */
export default function Verse() {
  const params = useLocalSearchParams<{ ref?: string }>();
  return <UnderstandRoute refText={params.ref ?? ""} />;
}

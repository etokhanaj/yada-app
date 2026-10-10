import { useLocalSearchParams } from "expo-router";

import { RelatedRoute } from "../../components/UnderstandViews";

/** Related passages from Go further, pushed inside the Understand sheet (brief §8.19). */
export default function Related() {
  const params = useLocalSearchParams<{ ref?: string }>();
  return <RelatedRoute refText={params.ref ?? ""} />;
}

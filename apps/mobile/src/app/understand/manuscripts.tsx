import { useLocalSearchParams } from "expo-router";

import { ManuscriptsPage } from "../../components/UnderstandPages";

/** Go deeper's Manuscripts row (VS-04): what the manuscripts differ on, from the BSB's own footnotes. */
export default function Page() {
  const params = useLocalSearchParams<{ ref?: string }>();
  return <ManuscriptsPage refText={params.ref ?? ""} />;
}

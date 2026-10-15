import { useLocalSearchParams } from "expo-router";

import { SeeAlsoPage } from "../../components/UnderstandPages";

/** See also, all of it, from "Show all N" (SN-08). */
export default function Page() {
  const params = useLocalSearchParams<{ ref?: string; term?: string }>();
  return <SeeAlsoPage refText={params.ref ?? ""} />;
}

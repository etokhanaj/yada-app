import { useLocalSearchParams } from "expo-router";

import { SeeAlsoRoute } from "../../components/UnderstandViews";

/** See also, all of it, from "Show all N", pushed inside the Understand sheet (canvas SN-08). */
export default function SeeAlso() {
  const params = useLocalSearchParams<{ ref?: string }>();
  return <SeeAlsoRoute refText={params.ref ?? ""} />;
}

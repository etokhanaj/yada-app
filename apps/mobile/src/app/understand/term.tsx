import { useLocalSearchParams } from "expo-router";

import { TermPage } from "../../components/UnderstandPages";

/** One key word's page, pushed inside the sheet (DI-02, DN-01). */
export default function Page() {
  const params = useLocalSearchParams<{ ref?: string; term?: string }>();
  return <TermPage refText={params.ref ?? ""} term={params.term ?? ""} />;
}

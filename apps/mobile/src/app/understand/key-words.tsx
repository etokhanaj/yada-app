import { useLocalSearchParams } from "expo-router";

import { KeyWordsPage } from "../../components/UnderstandPages";

/** Key words for a verse or a passage, pushed inside the sheet (DI-01). */
export default function Page() {
  const params = useLocalSearchParams<{ ref?: string; term?: string }>();
  return <KeyWordsPage refText={params.ref ?? ""} />;
}

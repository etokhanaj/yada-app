import { useLocalSearchParams } from "expo-router";

import { StudyNotesScreen } from "../../components/StudyLayer";
import { resolveRef } from "../../lib/chapters";

/** "Read the whole note" and Go further's Study notes row, pushed inside the Understand sheet (canvas SN-02). */
export default function Notes() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const span = resolveRef(params.ref ?? "");
  if (span === null) return null;
  return <StudyNotesScreen book={span.book} ord={span.startOrd} from={params.ref ?? ""} />;
}

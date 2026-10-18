/**
 * Why a verse is not in your version (CP-08 → PD-06): pushed inside Compare's sheet from "Why: not in the
 * oldest manuscripts", ‹ back to Compare. The note itself is components/OmittedVerse.tsx.
 */

import { formatDisplayRef, ordToParts } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";

import { OmittedVerseNote, useOmittedVerse } from "../../components/OmittedVerse";
import { SheetScreen } from "../../components/Sheet";
import { resolveRef } from "../../lib/chapters";

export default function MissingVerseScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const span = resolveRef(params.ref ?? "");
  const note = useOmittedVerse(span?.startOrd ?? null);
  const title = span === null ? "" : formatDisplayRef(ordToParts(span.startOrd));
  return (
    <SheetScreen title={title} backLabel={title} footer={false} closeLabel="Close" testID="missing-verse">
      {note !== null ? <OmittedVerseNote note={note} /> : null}
    </SheetScreen>
  );
}

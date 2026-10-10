/**
 * Compare the readings (J01-09): the disputed question as the title, then each
 * reading as a label, its case and the verses it rests on, in the order the
 * entry gives them. Same rhythm for every reading, no colour, no winner:
 * there is no winner field (claims.ts).
 */

import { formatDisplayRef, parseVerseId } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Chip, SheetScreen } from "../../components/Sheet";
import { Prose, Scripture } from "../../components/Type";
import { useQuery } from "../../data/AppData";
import { isUnreviewed, loadEntry } from "../../data/understand";
import { useAXLevel, useLayout } from "../../design/tokens";
import { formatRange } from "../../lib/chapters";
import { lexicalNotes, readingsTitle, verseLinks } from "../../lib/evidence";

export default function ReadingsScreen() {
  const params = useLocalSearchParams<{ verse?: string; claim?: string }>();
  const verseId = params.verse ?? "";
  const ref = parseVerseId(verseId);
  const ax = useAXLevel() >= 1;
  const { sectionGap } = useLayout();
  const display = ref === null ? "" : formatDisplayRef(ref);

  const { data } = useQuery(async () => (ref === null ? null : loadEntry(ref.book, verseId)), [verseId]);
  const claim = data?.entry.claims.find((c) => c.id === params.claim) ?? null;
  const title = claim === null ? "Readings" : readingsTitle(claim.claim);

  return (
    <SheetScreen title={title} subtitle={display} unreviewed={data != null && isUnreviewed(data.reviewStatus)} backLabel={display} verseId={verseId} closeLabel="Back to Understand" testID="readings">
      {claim?.positions?.map((position, index) => {
        const links = verseLinks(position.evidence, verseId);
        const notes = lexicalNotes(position.evidence);
        return (
          <View key={position.label} style={{ marginTop: index === 0 ? 0 : sectionGap }}>
            <Scripture style={{ fontSize: ax ? 17 : 20, lineHeight: ax ? 22 : 26, fontWeight: "600", letterSpacing: -0.2, marginBottom: 6 }}>
              {position.label}
            </Scripture>
            <Prose step="claim">{position.case}</Prose>
            {links.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {links.map((link) => (
                  <Chip
                    key={link.ref}
                    label={formatRange(link.ref)}
                    onPress={() => router.push({ pathname: "/evidence/peek", params: { ref: link.ref, from: verseId, note: link.note ?? "", unreviewed: data != null && isUnreviewed(data.reviewStatus) ? "1" : "" } })}
                  />
                ))}
              </View>
            ) : null}
            {notes.map((n) => (
              <Prose key={n.lemma + n.note} step="note" tone="muted" style={{ marginTop: 8 }}>
                {n.lemma} · {n.note}
                {n.dataset === null ? "" : ` · ${n.dataset}`}
              </Prose>
            ))}
          </View>
        );
      })}
      {claim !== null
        ? lexicalNotes(claim.evidence).map((n) => (
            <Prose key={n.lemma + n.note} step="note" tone="muted" style={{ marginTop: sectionGap }}>
              {n.lemma} · {n.note}
              {n.dataset === null ? "" : ` · ${n.dataset}`}
            </Prose>
          ))
        : null}
    </SheetScreen>
  );
}

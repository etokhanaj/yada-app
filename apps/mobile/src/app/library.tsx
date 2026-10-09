/**
 * Library: the Understand books this build carries, and where every word of
 * text comes from.
 *
 * Understand books are a plain list — name, entries, size — as Coursera and
 * Disney+ list downloads, without storage bars
 * (https://mobbin.com/screens/d1ae619d-0061-444a-bc02-74df31cd19fd,
 * https://mobbin.com/screens/9343e7b1-2483-4855-9655-0785d42c88a6).
 * All bundles ship inside the app in v1 (John's decision 4), so there is no
 * remove and no download: the list says what is here, nothing more.
 *
 * Sources & licences are read from the core bundle's `sources` table, which
 * the pipeline writes from sources.manifest.json — including each
 * encumbrance, shown in full rather than summarised away.
 */

import { BOOK_CODES } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { PageHeader } from "../components/PageHeader";
import { Label, Prose } from "../components/Type";
import { useCore, useQuery } from "../data/AppData";
import { CORE_BUNDLE, UNDERSTAND_BUNDLES } from "../data/bundles";
import { getSources } from "../data/queries";
import { SPACE, usePalette } from "../design/tokens";

function megabytes(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const palette = usePalette();
  const core = useCore();
  const scroll = useRef<ScrollView>(null);
  const { data: sources } = useQuery(() => getSources(core), []);

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <PageHeader title={params.section === "sources" ? "Sources & licences" : "Library"} />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxl }}>
        {params.section === "sources" ? null : (
          <View style={{ marginBottom: SPACE.xl }}>
            <Label style={{ marginBottom: SPACE.sm }}>Understand books</Label>
            {UNDERSTAND_BUNDLES.map((bundle) => (
              <View key={bundle.file} style={[styles.row, { borderTopColor: palette.divider }]} testID={`library-${bundle.book ?? bundle.name}`}>
                <View style={styles.line}>
                  <Prose step="claim" style={{ flexShrink: 1 }}>
                    {bundle.book === undefined ? bundle.name : BOOK_CODES[bundle.book].name}
                  </Prose>
                  <Prose step="note" tone="muted">
                    {megabytes(bundle.bytes)}
                  </Prose>
                </View>
                <Prose step="note" tone="muted">
                  {bundle.entries} {bundle.entries === 1 ? "verse explained" : "verses explained"} · version {bundle.version}
                </Prose>
                {bundle.review_gate === "unreviewed-dev" ? <Label style={{ marginTop: SPACE.xs }}>Draft · not yet reviewed</Label> : null}
              </View>
            ))}
            {CORE_BUNDLE !== undefined ? (
              <Prose step="note" tone="muted" style={{ marginTop: SPACE.md }}>
                All 66 books’ text and original language: {megabytes(CORE_BUNDLE.bytes)}, included with the app.
              </Prose>
            ) : null}
          </View>
        )}

        <Label style={{ marginBottom: SPACE.sm }}>Sources & licences</Label>
        {(sources ?? []).map((source) => (
          <View key={source.dataset} style={[styles.row, { borderTopColor: palette.divider }]}>
            <Prose step="claim">{source.dataset}</Prose>
            <Prose step="note" tone="muted" style={{ marginTop: SPACE.xs }}>
              {source.attribution}
            </Prose>
            <Label style={{ marginTop: SPACE.xs }}>
              {source.license.replace(/_/g, " ")} · {source.source}
            </Label>
            <Prose step="note" tone="muted" selectable>
              {source.url}
            </Prose>
            {source.encumbered !== null && source.encumbered !== "" ? (
              <Prose step="note" style={{ marginTop: SPACE.xs }} testID={`encumbered-${source.dataset}`}>
                Restriction: {source.encumbered}
              </Prose>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.md,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    columnGap: SPACE.md,
  },
});

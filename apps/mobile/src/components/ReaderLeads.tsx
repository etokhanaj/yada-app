/**
 * What stands above a passage's text in the reader, from its Understand data (build plan Phase 2):
 *
 * - a prophet's section in plain words and its one setting line (JR-04);
 * - a psalm's two lines before the psalm, and "About this psalm" for the rest (JR-01, JR-02);
 * - the one-time tip the first time a reader opens a psalm (JR-01), in John's approved wording, with
 *   Psalm 27:1 quoted exactly from the BSB.
 *
 * A line that repeats what is already on screen there is left out (John, 12 Oct 2026): Isaiah 40's
 * setting line under its section name, Psalm 51's "Written when…" over its superscription.
 */

import { verseOrd } from "@yada/schema";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useCore, useQuery } from "../data/AppData";
import { getTexts } from "../data/queries";
import { usePalette } from "../design/tokens";
import { halves, type ProphetLead } from "../lib/passageGuide";
import { useSettings } from "../state/settings";
import { Icon } from "./Icon";
import { Chrome, Prose, Scripture } from "./Type";

export function ProphetLeadLines({ lead }: { lead: ProphetLead }) {
  return (
    <View style={{ marginBottom: 12 }} testID="prophet-lead">
      {lead.section !== null ? (
        <Chrome step="label" tone="muted" accessibilityRole="header">
          {lead.section}
        </Chrome>
      ) : null}
      {lead.setting !== null ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 2 }}>
          {lead.setting}
        </Chrome>
      ) : null}
    </View>
  );
}

export function PsalmLeadLines({ lines, passageId, about }: { lines: readonly string[]; passageId: string; about: boolean }) {
  const palette = usePalette();
  return (
    <View style={{ marginBottom: 14 }} testID="psalm-lead">
      {lines.map((line) => (
        <Chrome key={line} step="note" tone="muted" style={{ marginBottom: 4 }}>
          {line}
        </Chrome>
      ))}
      {about ? (
        <Pressable
          onPress={() => router.push({ pathname: "/guide/about", params: { ref: passageId } })}
          accessibilityRole="button"
          accessibilityLabel="About this psalm"
          testID="about-psalm"
          style={({ pressed }) => [styles.pill, { backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 }]}
        >
          <Chrome tone="ink" size={15} style={{ fontWeight: "500" }}>
            About this psalm
          </Chrome>
          <Icon name="forward" size={16} tone="muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** JR-01: once per device, above the first psalm a reader opens. */
export function PsalmTip() {
  const core = useCore();
  const palette = usePalette();
  const markPsalmTipSeen = useSettings((s) => s.markPsalmTipSeen);
  const { data } = useQuery(async () => (await getTexts(core, verseOrd("PSA", 27, 1)))["BSB"] ?? null, []);
  if (data === undefined || data === null) return null;
  return (
    <View style={{ marginBottom: 28 }} testID="psalm-tip">
      <Prose step="claim">Hebrew poetry often says one thing twice, in different words.</Prose>
      <View accessible accessibilityLabel={`${data} Psalm 27, verse 1, BSB.`} style={{ marginTop: 10 }}>
        {halves(data).map((half) => (
          <Scripture key={half} step="claim" style={{ fontFamily: "Literata" }}>
            {half}
          </Scripture>
        ))}
        <Chrome step="note" tone="muted" style={{ marginTop: 2 }}>
          Psalm 27:1, BSB
        </Chrome>
      </View>
      <Pressable
        onPress={markPsalmTipSeen}
        accessibilityRole="button"
        testID="psalm-tip-done"
        style={({ pressed }) => [styles.pill, { backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1, marginTop: 12 }]}
      >
        <Chrome tone="ink" size={15} style={{ fontWeight: "500" }}>
          Got it
        </Chrome>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 999,
    marginTop: 6,
  },
});

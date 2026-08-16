/**
 * Understand: visually a sheet, semantically a mode. One scrolling surface,
 * never five destinations. The default viewport must read like an annotation,
 * not a study guide — if the user has to scroll significantly before
 * understanding what the verse is about, the default state has failed.
 */

import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Claim, VerseEntry } from "@yada/schema";
import type { Script } from "../data/passages";
import { leading, LTR_PROSE, METADATA_LABEL, SPACE, TYPE, usePalette } from "../design/tokens";
import { ClaimList } from "./Claims";
import { Original } from "./Original";

const FIRST_SCREEN_SEEN = 3;
const FIRST_SCREEN_DIFFERS = 2;

export function Understand({
  entry,
  reference,
  verseText,
  script,
  onBackToReading,
  readingLabel,
  initialOriginalOpen = false,
}: {
  entry: VerseEntry;
  reference: string;
  verseText: string;
  script: Script;
  onBackToReading: () => void;
  readingLabel: string;
  /** Seeded from a deep link so screenshot states are reproducible. */
  initialOriginalOpen?: boolean;
}) {
  const palette = usePalette();
  const [showAllSeen, setShowAllSeen] = useState(false);
  const [showAllDiffers, setShowAllDiffers] = useState(false);
  const [originalOpen, setOriginalOpen] = useState(initialOriginalOpen);

  const { seen, differs } = useMemo(() => groupClaims(entry.claims), [entry.claims]);

  const occurrences = (surface: string): number =>
    entry.gloss.filter((word) => word.surface === surface).length;

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <View style={styles.grabberWell}>
        <View style={[styles.grabber, { backgroundColor: palette.divider }]} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>{reference}</Text>
        <Text
          style={{
            fontFamily: "Literata",
            fontSize: TYPE.scripture.size,
            letterSpacing: TYPE.scripture.tracking,
            lineHeight: leading(TYPE.scripture.size, TYPE.scripture.ratio),
            color: palette.ink,
            marginTop: SPACE.sm,
          }}
        >
          {verseText}
        </Text>

        <View style={[styles.hairline, { backgroundColor: palette.divider }]} />

        <Text
          style={[
            LTR_PROSE,
            {
              fontSize: TYPE.explanation.size,
              letterSpacing: TYPE.explanation.tracking,
              lineHeight: leading(TYPE.explanation.size, TYPE.explanation.ratio),
              color: palette.ink,
            },
          ]}
        >
          {entry.whats_happening}
        </Text>

        <Group
          title="What we can see"
          claims={seen}
          expanded={showAllSeen}
          cap={FIRST_SCREEN_SEEN}
          onToggle={() => setShowAllSeen((value) => !value)}
        />

        <Group
          title="Where interpretation differs"
          claims={differs}
          expanded={showAllDiffers}
          cap={FIRST_SCREEN_DIFFERS}
          onToggle={() => setShowAllDiffers((value) => !value)}
        />

        <View style={{ marginTop: SPACE.xl }}>
          <Pressable onPress={() => setOriginalOpen((value) => !value)}>
            <Text style={[METADATA_LABEL, { color: palette.accent }]}>
              {script === "hebrew" ? "Original Hebrew" : "Original Greek"} ·{" "}
              {originalOpen ? "Hide" : "Show"}
            </Text>
          </Pressable>
          {originalOpen ? (
            <View style={{ marginTop: SPACE.md }}>
              <Original gloss={entry.gloss} script={script} occurrences={occurrences} />
              <Text
                style={{
                  fontSize: TYPE.meta.size,
                  color: palette.mutedInk,
                  marginTop: SPACE.md,
                }}
              >
                Word-for-word gloss, derived from alignment data.
              </Text>
              <Text
                style={[
                  LTR_PROSE,
                  {
                    fontSize: TYPE.claim.size,
                    lineHeight: leading(TYPE.claim.size, TYPE.claim.ratio),
                    color: palette.ink,
                    marginTop: SPACE.sm,
                  },
                ]}
              >
                {entry.close_rendering}
              </Text>
              <Text style={{ fontSize: TYPE.meta.size, color: palette.mutedInk }}>
                Close rendering, composed and reviewed.
              </Text>
            </View>
          ) : null}
        </View>

        {entry.translation_note !== undefined ? (
          <View style={{ marginTop: SPACE.xl }}>
            <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>Why this translation</Text>
            <Text
              style={[
                LTR_PROSE,
                {
                  fontSize: TYPE.claim.size,
                  lineHeight: leading(TYPE.claim.size, TYPE.claim.ratio),
                  color: palette.ink,
                  marginTop: SPACE.sm,
                },
              ]}
            >
              {entry.translation_note}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: SPACE.xl }}>
          <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>Go deeper</Text>
          {entry.related_passages.map((related) => (
            <View key={related.ref} style={{ marginTop: SPACE.md }}>
              <Text style={{ fontSize: TYPE.claim.size, color: palette.accent }}>
                ↳ {related.ref}
                {related.relationship === undefined ? "" : ` · ${related.relationship}`}
              </Text>
              {related.note !== undefined ? (
                <Text
                  style={{
                    fontSize: TYPE.meta.size,
                    lineHeight: leading(TYPE.meta.size, TYPE.meta.ratio),
                    color: palette.mutedInk,
                    marginTop: SPACE.xs,
                  }}
                >
                  {related.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <Pressable
        onPress={onBackToReading}
        style={[styles.backBar, { borderTopColor: palette.divider, backgroundColor: palette.paper }]}
        accessibilityRole="button"
      >
        <Text style={{ color: palette.accent, fontSize: TYPE.claim.size }}>
          ‹ Back to reading — {readingLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function Group({
  title,
  claims,
  expanded,
  cap,
  onToggle,
}: {
  title: string;
  claims: Claim[];
  expanded: boolean;
  cap: number;
  onToggle: () => void;
}) {
  const palette = usePalette();
  if (claims.length === 0) return null;
  const visible = expanded ? claims : claims.slice(0, cap);

  return (
    <View style={{ marginTop: SPACE.xl }}>
      <Text style={[METADATA_LABEL, { color: palette.mutedInk, marginBottom: SPACE.sm }]}>
        {title}
      </Text>
      <ClaimList claims={visible} />
      {claims.length > cap ? (
        <Pressable onPress={onToggle} style={{ paddingTop: SPACE.md }}>
          <Text style={{ color: palette.accent, fontSize: TYPE.claim.size }}>
            {expanded ? "Show fewer" : `Show all ${claims.length}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Four categories, two neutral reader groups, ordered by display_rank. */
function groupClaims(claims: Claim[]): { seen: Claim[]; differs: Claim[] } {
  const byRank = (a: Claim, b: Claim): number => a.display_rank - b.display_rank;
  return {
    seen: claims
      .filter((c) => c.category === "text" || c.category === "context")
      .sort(byRank),
    differs: claims
      .filter((c) => c.category === "interpretation" || c.category === "debated")
      .sort(byRank),
  };
}

const styles = StyleSheet.create({
  grabberWell: {
    alignItems: "center",
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xs,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginVertical: SPACE.lg,
  },
  body: {
    padding: SPACE.lg,
    paddingBottom: SPACE.xl * 2,
  },
  backBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: SPACE.md,
    alignItems: "center",
  },
});

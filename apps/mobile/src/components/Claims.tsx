/**
 * Claim rows: scholarly marginalia, never cards.
 *
 * Quiet rows separated by hairlines, a tiny tracked-uppercase label, the claim
 * in prose. The label is the evidence strength the reader is meant to see —
 * never the internal confidence, and never the four-category taxonomy, which
 * the reader meets only as the two neutral groups (claims.ts, displayGroup).
 * Debate has no winner: positions are counted, not ranked.
 */

import type { Claim } from "@yada/schema";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SPACE, usePalette } from "../design/tokens";
import { Chrome, Label, Prose } from "./Type";

export function ClaimGroup({
  title,
  claims,
  cap,
  verseId,
}: {
  title: string;
  claims: readonly Claim[];
  cap: number;
  verseId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const palette = usePalette();
  if (claims.length === 0) return null;
  const visible = expanded ? claims : claims.slice(0, cap);

  return (
    <View style={{ marginTop: SPACE.xl }}>
      <Label style={{ marginBottom: SPACE.sm }}>{title}</Label>
      {visible.map((claim) => (
        <Pressable
          key={claim.id}
          onPress={() => router.push({ pathname: "/why", params: { verse: verseId, claim: claim.id } })}
          style={({ pressed }) => [
            styles.row,
            { borderTopColor: palette.divider },
            // Feedback on press-in; waiting for release feels dead.
            pressed ? { backgroundColor: palette.selection } : null,
          ]}
          accessibilityRole="button"
          accessibilityHint="Opens why we say that"
          testID={`claim-${claim.id}`}
        >
          <Label accessibilityRole="text">{claim.evidence_strength}</Label>
          <Prose step="claim" style={{ marginTop: SPACE.xs }}>
            {claim.claim}
          </Prose>
          {claim.positions !== undefined ? (
            <Chrome size={13} style={{ marginTop: SPACE.xs }}>
              Compare {claim.positions.length} positions
            </Chrome>
          ) : null}
        </Pressable>
      ))}
      {claims.length > cap ? (
        <Pressable onPress={() => setExpanded((v) => !v)} style={{ paddingTop: SPACE.md }} accessibilityRole="button">
          <Chrome size={16}>{expanded ? "Show fewer" : `Show all ${claims.length}`}</Chrome>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Two neutral groups, each in display_rank order (PRD §8.2). */
export function groupClaims(claims: readonly Claim[]): { seen: Claim[]; differs: Claim[] } {
  const byRank = (a: Claim, b: Claim): number => a.display_rank - b.display_rank;
  return {
    seen: claims.filter((c) => c.category === "text" || c.category === "context").sort(byRank),
    differs: claims.filter((c) => c.category === "interpretation" || c.category === "debated").sort(byRank),
  };
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.md,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
  },
});

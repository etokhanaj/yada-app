/**
 * Claim rows: the claim, a label only for the exceptions (Supported,
 * Background; decision 4), a trailing chevron, the whole row the target.
 * Disputed rows offer their readings side by side instead of a label.
 * Debate has no winner: positions are counted, not ranked.
 */

import type { Claim } from "@yada/schema";
import { useState } from "react";
import { View } from "react-native";

import { claimKind, claimLabel } from "../lib/evidence";
import { Row, TextLink } from "./Sheet";
import { Chrome, Prose } from "./Type";

export function ClaimRows({
  claims,
  cap,
  onOpen,
  onReadings,
  labels = true,
}: {
  claims: readonly Claim[];
  /** First-screen cap from the brief: 3 things we can see, 2 places readings differ. */
  cap: number;
  onOpen: (claim: Claim) => void;
  onReadings: (claim: Claim) => void;
  /** False inside the passage guide (PG-04 draws no Supported / Background). */
  labels?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (claims.length === 0) return null;
  const visible = expanded ? claims : claims.slice(0, cap);

  return (
    <View>
      {visible.map((claim, index) => {
        const label = labels ? claimLabel(claim) : null;
        // A debated claim's whole row opens its readings. A link nested inside the row was a second control
        // VoiceOver could not reach on its own, about 20 pt tall (WCAG 2.5.8, 4.1.2; accessibility pass, 11 Oct 2026).
        const readings = claim.positions === undefined ? null : `Compare the ${claim.positions.length} readings`;
        return (
          <Row
            key={claim.id}
            first={index === 0}
            onPress={() => (readings === null ? onOpen(claim) : onReadings(claim))}
            label={[claim.claim, label, readings].filter((part) => part !== null).join(", ")}
            hint={readings === null ? "Shows why we say this" : "Shows each reading and its evidence"}
            testID={readings === null ? `claim-${claim.id}` : `readings-${claim.id}`}
          >
            <Prose step="claim">{claim.claim}</Prose>
            {label !== null ? (
              <Chrome step="note" tone="muted" style={{ fontWeight: "500", marginTop: 2 }}>
                {label}
              </Chrome>
            ) : null}
            {readings !== null ? (
              <Chrome step="note" tone="accent" style={{ fontWeight: "600", marginTop: 4 }}>
                {readings}
              </Chrome>
            ) : null}
          </Row>
        );
      })}
      {claims.length > cap && !expanded ? (
        <TextLink label={`Show all ${claims.length}`} onPress={() => setExpanded(true)} testID="show-all" />
      ) : null}
    </View>
  );
}

/**
 * Two neutral groups, each in display_rank order (PRD §8.2), with the grammar
 * claims taken out of What we can see: they sit under Original as "In the
 * Greek / Hebrew" (brief §8.19), so a reader meets plain claims first.
 */
export function groupClaims(claims: readonly Claim[]): { seen: Claim[]; grammar: Claim[]; differs: Claim[] } {
  const byRank = (a: Claim, b: Claim): number => a.display_rank - b.display_rank;
  const plain = claims.filter((c) => c.category === "text" || c.category === "context").sort(byRank);
  return {
    seen: plain.filter((c) => claimKind(c) === "reading"),
    grammar: plain.filter((c) => claimKind(c) === "grammar"),
    differs: claims.filter((c) => c.category === "interpretation" || c.category === "debated").sort(byRank),
  };
}

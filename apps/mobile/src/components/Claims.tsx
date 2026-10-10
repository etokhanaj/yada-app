/**
 * Claim rows: the claim, a label only for the exceptions (Supported,
 * Background; decision 4), a trailing chevron, the whole row the target.
 * Disputed rows offer their readings side by side instead of a label.
 * Debate has no winner: positions are counted, not ranked.
 */

import type { Claim } from "@yada/schema";
import { useState } from "react";
import { View } from "react-native";

import { claimLabel } from "../lib/evidence";
import { Row, TextLink } from "./Sheet";
import { Chrome, Prose } from "./Type";

export function ClaimRows({
  claims,
  cap,
  onOpen,
  onReadings,
}: {
  claims: readonly Claim[];
  /** First-screen cap from the brief: 3 things we can see, 2 places readings differ. */
  cap: number;
  onOpen: (claim: Claim) => void;
  onReadings: (claim: Claim) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (claims.length === 0) return null;
  const visible = expanded ? claims : claims.slice(0, cap);

  return (
    <View>
      {visible.map((claim, index) => {
        const label = claimLabel(claim);
        return (
          <Row
            key={claim.id}
            first={index === 0}
            onPress={() => onOpen(claim)}
            label={`${claim.claim}${label === null ? "" : `, ${label}`}`}
            hint="Shows why we say this"
            testID={`claim-${claim.id}`}
          >
            <Prose step="claim">{claim.claim}</Prose>
            {label !== null ? (
              <Chrome step="note" tone="muted" style={{ fontWeight: "500", marginTop: 2 }}>
                {label}
              </Chrome>
            ) : null}
            {claim.positions !== undefined ? (
              <TextLink
                label={`Compare the ${claim.positions.length} readings`}
                onPress={() => onReadings(claim)}
                testID={`readings-${claim.id}`}
              />
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

/** Two neutral groups, each in display_rank order (PRD §8.2). */
export function groupClaims(claims: readonly Claim[]): { seen: Claim[]; differs: Claim[] } {
  const byRank = (a: Claim, b: Claim): number => a.display_rank - b.display_rank;
  return {
    seen: claims.filter((c) => c.category === "text" || c.category === "context").sort(byRank),
    differs: claims.filter((c) => c.category === "interpretation" || c.category === "debated").sort(byRank),
  };
}

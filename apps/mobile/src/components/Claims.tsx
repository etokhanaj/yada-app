/**
 * Claim rows and the "Why do we say that?" chain of custody.
 *
 * Claims render as scholarly marginalia: quiet rows with tiny tracked-uppercase
 * labels, never contained cards. Containers make Yada read as an AI knowledge
 * product; the typography carries the hierarchy instead. Debate is presented
 * without visually staging a debate — different rhythm, not different colour,
 * and no winner anywhere.
 */

import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Claim } from "@yada/schema";
import { leading, METADATA_LABEL, SPACE, TYPE, usePalette } from "../design/tokens";

function strengthLabel(claim: Claim): string {
  return `${claim.category} · ${claim.evidence_strength}`;
}

export function ClaimList({ claims }: { claims: Claim[] }) {
  const [open, setOpen] = useState<Claim | null>(null);
  const palette = usePalette();

  return (
    <View>
      {claims.map((claim) => (
        <Pressable
          key={claim.id}
          onPress={() => setOpen(claim)}
          style={[styles.row, { borderTopColor: palette.divider }]}
          accessibilityRole="button"
          accessibilityHint="Opens why we say that"
        >
          <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>{strengthLabel(claim)}</Text>
          <Text
            style={{
              fontSize: TYPE.claim.size,
              lineHeight: leading(TYPE.claim.size, TYPE.claim.ratio),
              color: palette.ink,
              marginTop: SPACE.xs,
            }}
          >
            {claim.claim}
          </Text>
          {claim.positions !== undefined ? (
            <Text
              style={{
                fontSize: TYPE.meta.size,
                color: palette.accent,
                marginTop: SPACE.xs,
              }}
            >
              Compare {claim.positions.length} positions
            </Text>
          ) : null}
        </Pressable>
      ))}

      <WhySheet claim={open} onDismiss={() => setOpen(null)} />
    </View>
  );
}

/**
 * One pattern, three renderings: morphological claims show parsing and source,
 * historical claims show the statement and its grounding, interpretive claims
 * show the positions. It answers "how do you know?" identically everywhere.
 */
function WhySheet({ claim, onDismiss }: { claim: Claim | null; onDismiss: () => void }) {
  const palette = usePalette();
  if (claim === null) return null;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: palette.paper }}>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>Why do we say that?</Text>
          <Text
            style={{
              fontSize: TYPE.explanation.size,
              lineHeight: leading(TYPE.explanation.size, TYPE.explanation.ratio),
              color: palette.ink,
              marginTop: SPACE.sm,
            }}
          >
            {claim.claim}
          </Text>

          <Section title="Grounding" palette={palette}>
            <Text style={{ fontSize: TYPE.claim.size, color: palette.ink }}>
              {claim.grounding === "source_data"
                ? "Recoverable from the supplied source data."
                : "Model knowledge, not grounded in a supplied dataset. Capped at supported and hedged."}
            </Text>
          </Section>

          {claim.evidence.length > 0 ? (
            <Section title="Evidence" palette={palette}>
              {claim.evidence.map((evidence, index) => (
                <Text
                  key={index}
                  style={{
                    fontSize: TYPE.claim.size,
                    lineHeight: leading(TYPE.claim.size, TYPE.claim.ratio),
                    color: palette.ink,
                    marginBottom: SPACE.xs,
                  }}
                >
                  {evidence.type === "verse"
                    ? `${evidence.ref}${evidence.note === undefined ? "" : ` — ${evidence.note}`}`
                    : evidence.type === "lexical"
                      ? `${evidence.lemma}${evidence.strongs === undefined ? "" : ` (${evidence.strongs})`}${
                          evidence.note === undefined ? "" : ` — ${evidence.note}`
                        }${evidence.dataset === undefined ? "" : `  ·  ${evidence.dataset}`}`
                      : `${evidence.ref}${evidence.dataset === undefined ? "" : `  ·  ${evidence.dataset}`}`}
                </Text>
              ))}
            </Section>
          ) : null}

          {claim.positions !== undefined ? (
            <Section title="Where interpretation differs" palette={palette}>
              {claim.positions.map((position) => (
                <View key={position.label} style={{ marginBottom: SPACE.md }}>
                  <Text
                    style={{
                      fontSize: TYPE.claim.size,
                      fontWeight: "600",
                      color: palette.ink,
                    }}
                  >
                    {position.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: TYPE.claim.size,
                      lineHeight: leading(TYPE.claim.size, TYPE.claim.ratio),
                      color: palette.ink,
                      marginTop: SPACE.xs,
                    }}
                  >
                    {position.case}
                  </Text>
                </View>
              ))}
            </Section>
          ) : null}
        </ScrollView>

        <Pressable onPress={onDismiss} style={[styles.backBar, { borderTopColor: palette.divider }]}>
          <Text style={{ color: palette.accent, fontSize: TYPE.claim.size }}>‹ Back</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: ReturnType<typeof usePalette>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: SPACE.lg }}>
      <Text style={[METADATA_LABEL, { color: palette.mutedInk, marginBottom: SPACE.sm }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.md,
  },
  sheetBody: {
    padding: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  backBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: SPACE.md,
    alignItems: "center",
  },
});

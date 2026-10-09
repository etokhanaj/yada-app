/**
 * "Why do we say that?" — the chain of custody behind one claim.
 *
 * One pattern, three renderings: a morphological claim shows its parsing and
 * source, a historical claim its grounding, an interpretive one its positions.
 * Positions are listed in the order the entry gives them with nothing marking
 * a winner, because there is no winner field (claims.ts).
 */

import type { Claim, EvidenceRef } from "@yada/schema";
import { formatDisplayRef, parseVerseId } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { useSheetNav } from "../components/navigation";
import { DraftLabel, Hairline, LinkRow, Section, SheetScreen } from "../components/Sheet";
import { Label, Prose } from "../components/Type";
import { useLog, useQuery } from "../data/AppData";
import { isUnreviewed, loadEntry } from "../data/understand";
import { SPACE } from "../design/tokens";
import { formatRange, resolveRef } from "../lib/chapters";

const GROUNDING: Record<Claim["grounding"], string> = {
  source_data: "Recoverable from the source data Yada ships: the Greek or Hebrew text, its morphology, or the alignment tables.",
  model_knowledge:
    "Background knowledge, not grounded in a dataset Yada ships. Claims like this are capped at “supported” and never shown as strong.",
};

export default function WhyScreen() {
  const params = useLocalSearchParams<{ verse?: string; claim?: string }>();
  const verseId = params.verse ?? "";
  const ref = parseVerseId(verseId);
  const log = useLog();
  const display = ref === null ? null : formatDisplayRef(ref);

  const { data } = useQuery(async () => (ref === null ? null : loadEntry(ref.book, verseId)), [verseId]);
  useEffect(() => log("claim_open", verseId, params.claim), [log, verseId, params.claim]);

  const claim = data?.entry.claims.find((c) => c.id === params.claim) ?? null;
  if (claim === null || data === undefined || data === null) return <SheetScreen backLabel={display}>{null}</SheetScreen>;

  return (
    <SheetScreen backLabel={display} verseId={verseId}>
      <Label accessibilityRole="header">Why do we say that?</Label>
      {isUnreviewed(data.reviewStatus) ? <DraftLabel /> : null}
      <Prose style={{ marginTop: SPACE.sm }} testID="why-claim">
        {claim.claim}
      </Prose>
      <Label style={{ marginTop: SPACE.sm }} accessibilityRole="text">
        {claim.evidence_strength}
      </Label>

      <Section title="Grounding">
        <Prose step="claim">{GROUNDING[claim.grounding]}</Prose>
      </Section>

      {claim.evidence.length > 0 ? (
        <Section title="Evidence">
          {claim.evidence.map((evidence, index) => (
            <EvidenceRow key={index} evidence={evidence} from={verseId} />
          ))}
        </Section>
      ) : null}

      {claim.positions !== undefined ? (
        <Section title="Where interpretation differs">
          {claim.positions.map((position, index) => (
            <View key={position.label}>
              {index > 0 ? <Hairline spacing={SPACE.md} /> : null}
              <Prose step="claim" style={{ fontWeight: "600" }}>
                {position.label}
              </Prose>
              <Prose step="claim" style={{ marginTop: SPACE.xs }}>
                {position.case}
              </Prose>
              {position.evidence.map((evidence, i) => (
                <EvidenceRow key={i} evidence={evidence} from={verseId} />
              ))}
            </View>
          ))}
        </Section>
      ) : null}
    </SheetScreen>
  );
}

function EvidenceRow({ evidence, from }: { evidence: EvidenceRef; from: string }) {
  const { jumpTo } = useSheetNav();
  const log = useLog();
  if (evidence.type === "verse") {
    const target = resolveRef(evidence.ref);
    return (
      <View style={{ marginTop: SPACE.xs }}>
        <LinkRow
          label={`${formatRange(evidence.ref)} ›`}
          onPress={() => {
            if (target === null) return;
            log("go_deeper", from, evidence.ref);
            jumpTo({ book: target.book, chapter: target.chapter, verse: target.startVerse, from, select: true });
          }}
        />
        {evidence.note !== undefined ? (
          <Prose step="note" tone="muted">
            {evidence.note}
          </Prose>
        ) : null}
      </View>
    );
  }
  if (evidence.type === "lexical") {
    const source = [evidence.dataset, evidence.analysis_tradition].filter((s) => s !== undefined).join(" · ");
    return (
      <View style={{ marginTop: SPACE.sm }}>
        <Prose step="claim">
          {evidence.lemma}
          {evidence.strongs === undefined ? "" : `  ${evidence.strongs}`}
        </Prose>
        {evidence.note !== undefined ? (
          <Prose step="note" tone="muted">
            {evidence.note}
          </Prose>
        ) : null}
        {source !== "" ? <Label style={{ marginTop: SPACE.xs }}>{source}</Label> : null}
      </View>
    );
  }
  return (
    <View style={{ marginTop: SPACE.sm }}>
      <Prose step="claim">Textual variation at {formatRange(evidence.ref)}</Prose>
      {evidence.witnesses !== undefined && evidence.witnesses.length > 0 ? (
        <Prose step="note" tone="muted">
          Witnesses: {evidence.witnesses.join(", ")}
        </Prose>
      ) : null}
      {evidence.note !== undefined ? (
        <Prose step="note" tone="muted">
          {evidence.note}
        </Prose>
      ) : null}
      {evidence.dataset !== undefined ? <Label style={{ marginTop: SPACE.xs }}>{evidence.dataset}</Label> : null}
    </View>
  );
}

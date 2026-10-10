/**
 * Why we say this (J01-05): the claim, how we know it, and where to look.
 * The claim in Literata at claim-reading size; one plain "How we know"
 * sentence from the claim's own grounding and datasets; links to the verses
 * it cites (never the verse already open); `See the word …` when the claim is
 * about one word in this verse. No evidence row that restates the claim (S2).
 */

import { formatDisplayRef, parseVerseId, verseOrd } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { Chip, Row, Section, SheetScreen } from "../../components/Sheet";
import { Chrome, Prose, Scripture } from "../../components/Type";
import { useCore, useLog, useQuery } from "../../data/AppData";
import { getTokens, scriptOf } from "../../data/queries";
import { isUnreviewed, loadEntry } from "../../data/understand";
import { useAXLevel } from "../../design/tokens";
import { formatRange } from "../../lib/chapters";
import { claimWord, howWeKnow, lexicalNotes, verseLinks } from "../../lib/evidence";

export default function WhyScreen() {
  const params = useLocalSearchParams<{ verse?: string; claim?: string }>();
  const verseId = params.verse ?? "";
  const ref = parseVerseId(verseId);
  const core = useCore();
  const log = useLog();
  const ax = useAXLevel() >= 1;
  const display = ref === null ? "" : formatDisplayRef(ref);

  const { data } = useQuery(async () => {
    if (ref === null) return null;
    const [loaded, tokens] = await Promise.all([loadEntry(ref.book, verseId), getTokens(core, verseOrd(ref.book, ref.chapter, ref.verse))]);
    return { loaded, tokens };
  }, [verseId]);
  useEffect(() => log("claim_open", verseId, params.claim), [log, verseId, params.claim]);

  const claim = data?.loaded?.entry.claims.find((c) => c.id === params.claim) ?? null;
  const shell = (children: React.ReactNode) => (
    <SheetScreen title="Why we say this" subtitle={display} unreviewed={data?.loaded != null && isUnreviewed(data.loaded.reviewStatus)} backLabel={display} verseId={verseId} closeLabel="Back to Understand" testID="why">
      {children}
    </SheetScreen>
  );
  if (ref === null || data === undefined || data === null || claim === null) return shell(null);

  const script = scriptOf(ref.book);
  const links = verseLinks(claim.evidence, verseId);
  const notes = lexicalNotes(claim.evidence);
  const word = claimWord(claim, data.tokens.words);
  const how = howWeKnow(claim, script, verseId);

  return shell(
    <>
      <Scripture style={ax ? undefined : { fontSize: 21, lineHeight: 29, letterSpacing: -0.2 }} testID="why-claim">
        {claim.claim}
      </Scripture>

      <Section title="How we know">
        {how !== null ? <Prose step="claim">{how}</Prose> : null}
        {notes.map((n) => (
          <Prose key={n.lemma + n.note} step="note" tone="muted" style={{ marginTop: 6 }}>
            {n.lemma} · {n.note}
            {n.dataset === null ? "" : ` · ${n.dataset}`}
          </Prose>
        ))}
        {claim.evidence
          .filter((e) => e.type === "apparatus" && e.note !== undefined)
          .map((e, i) => (
            <Prose key={i} step="note" tone="muted" style={{ marginTop: 6 }}>
              {"note" in e ? e.note : ""}
            </Prose>
          ))}
        {links.length > 0 ? (
          <View style={{ marginTop: 12, rowGap: 8 }}>
            {links.map((link) => (
              <View key={link.ref}>
                <View style={{ flexDirection: "row" }}>
                  <Chip
                    label={formatRange(link.ref)}
                    onPress={() => router.push({ pathname: "/evidence/peek", params: { ref: link.ref, from: verseId, note: link.note ?? "", unreviewed: data.loaded !== null && isUnreviewed(data.loaded.reviewStatus) ? "1" : "" } })}
                    testID={`evidence-${link.ref}`}
                  />
                </View>
                {link.note !== undefined ? (
                  <Prose step="note" tone="muted" style={{ marginTop: 4 }}>
                    {link.note}
                  </Prose>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </Section>

      {word !== null || claim.positions !== undefined ? (
        <View style={{ marginTop: 20 }}>
          {word !== null ? (
            <Row
              first
              onPress={() => router.push({ pathname: "/evidence/word", params: { ord: String(word.ord), pos: String(word.position), from: verseId } })}
              label={`See the word ${word.translit}`}
              testID="see-the-word"
            >
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                {/* Greek in chrome takes its own face (canvas J01-05). */}
                See the word <Chrome tone="ink" style={{ fontFamily: script === "hebrew" ? "NotoSerifHebrew" : "GentiumPlus", fontWeight: "400" }}>{word.surface}</Chrome>
              </Chrome>
            </Row>
          ) : null}
          {claim.positions !== undefined ? (
            <Row
              first={word === null}
              onPress={() => router.push({ pathname: "/evidence/readings", params: { verse: verseId, claim: claim.id } })}
              testID="see-readings"
            >
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                Compare the {claim.positions.length} readings
              </Chrome>
            </Row>
          ) : null}
        </View>
      ) : null}
    </>,
  );
}

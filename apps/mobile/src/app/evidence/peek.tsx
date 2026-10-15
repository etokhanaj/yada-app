/**
 * Peek before leaving (J01-10, brief §1 rule 5): the passage, how it relates,
 * the verses themselves, then `Read 1 Timothy 2` — the only control that
 * leaves the chapter. The reader then shows a return chip back to here.
 */

import { formatDisplayRef, ordToParts, parseVerseId, RelationshipSchema, verseOrd } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { DivineText } from "../../components/Verse";
import { useSheetNav } from "../../components/navigation";
import { Section, SheetScreen } from "../../components/Sheet";
import { Chrome, Original, Prose, Scripture } from "../../components/Type";
import { useCore, useLog, useQuery } from "../../data/AppData";
import { getTextsInRange, getTokens, isDownloaded, scriptOf } from "../../data/queries";
import { FONTS, LAYOUT, usePalette, useType } from "../../design/tokens";
import { formatRange, resolveRef } from "../../lib/chapters";
import { sameOpening } from "../../lib/echo";
import { RELATIONSHIP_LABEL } from "../../lib/evidence";
import { chapterTitle, splitSuperscription } from "../../lib/reader";
import { bsbStandsIn, notInLine, verseTextIn } from "../../lib/translations";
import { useSettings } from "../../state/settings";

export default function PeekScreen() {
  const params = useLocalSearchParams<{ ref?: string; from?: string; relationship?: string; note?: string; via?: string }>();
  const refText = params.ref ?? "";
  const span = resolveRef(refText);
  const from = params.from ?? "";
  const fromRef = parseVerseId(from);
  const core = useCore();
  const log = useLog();
  const palette = usePalette();
  const small = Math.round(useType("scripture").size * 0.85);
  const verseNumber = useType("verseNumber");
  const { jumpTo } = useSheetNav();
  const translation = useSettings((s) => s.translation);

  const { data } = useQuery(async () => (span === null ? null : getTextsInRange(core, span.startOrd, span.endOrd)), [refText]);
  // D-03: a passage that opens with the same words as the verse it came from shows the two openings paired.
  const { data: echo } = useQuery(async () => {
    if (span === null || fromRef === null) return null;
    const [mine, theirs] = await Promise.all([
      getTokens(core, verseOrd(fromRef.book, fromRef.chapter, fromRef.verse)),
      getTokens(core, span.startOrd),
    ]);
    return sameOpening(mine.words, theirs.words);
  }, [refText, from]);

  const title = span === null ? "" : formatRange(refText);
  const fromDisplay = fromRef === null ? "" : formatDisplayRef(fromRef);
  const parsed = RelationshipSchema.safeParse(params.relationship);
  const relationship = parsed.success ? RELATIONSHIP_LABEL[parsed.data] : null;
  const note = params.note === undefined || params.note === "" ? null : params.note;

  return (
    <SheetScreen
      title={title}
      subtitle={fromDisplay === "" ? undefined : `From ${fromDisplay}`}
      backLabel={fromDisplay}
      verseId={from}
      closeLabel={params.via === "search" ? "Close" : "Back to Understand"}
      backText={params.via === "search" ? "Back to search" : undefined}
      testID="peek"
    >
      {echo !== undefined && echo !== null && fromRef !== null && span !== null ? (
        <Section title="Same first words" first>
          {[
            { words: echo.a, script: scriptOf(fromRef.book), where: fromDisplay },
            { words: echo.b, script: scriptOf(span.book), where: formatDisplayRef(ordToParts(span.startOrd)) },
          ].map((side, i) => (
            <View
              key={side.where}
              accessible
              accessibilityLabel={`${side.words.map((w) => w.surface).join(" ")}, ${echo.gloss}, ${side.where}`}
              style={[styles.pair, i > 0 ? { boxShadow: `0 -1px 0 ${palette.divider}` } : null]}
            >
              <Original script={side.script} style={{ fontSize: 28, lineHeight: 40 }}>
                {side.words.map((w) => w.surface).join(" ")}
              </Original>
              <Prose step="note" tone="muted" style={{ flexShrink: 1, textAlign: "right" }}>
                {echo.gloss} · {side.where}
              </Prose>
            </View>
          ))}
        </Section>
      ) : relationship !== null || note !== null ? (
        <Section title={relationship ?? "Why it is here"} first>
          {note !== null ? <Prose step="claim">{note}</Prose> : null}
        </Section>
      ) : null}
      {/* J01-10: the passage set as the reader sets it, one paragraph per verse at reading size,
          so the peek previews what `Read` opens rather than a run-on quotation. */}
      <View style={{ marginTop: relationship !== null || note !== null ? 16 : 0 }}>
        {/* The peek quotes the passage, not an explanation, so it names the text it shows. */}
        {(data ?? []).some((v) => bsbStandsIn(v.texts, translation, isDownloaded(translation))) ? (
          <Chrome step="note" tone="muted" style={{ marginBottom: 10 }} testID="bsb-basis">
            Shown in BSB
          </Chrome>
        ) : null}
        {(data ?? []).map((v) => {
          const n = ordToParts(v.ord).verse;
          // A downloaded version without this verse keeps its number and says so, muted, rather
          // than setting BSB's words under ASV's name (lib/translations.ts, verseTextIn).
          const own = verseTextIn(v.texts, translation, isDownloaded(translation));
          const text = own ?? "";
          // A psalm's title gets its own italic line here too (amendment 12), not run into verse 1.
          const { title, body } = n === 1 ? splitSuperscription(text) : { title: null, body: text };
          return (
            <View key={v.ord}>
              {title !== null ? (
                <Scripture tone="muted" style={{ fontFamily: FONTS.scriptureItalic, fontSize: small, lineHeight: Math.round(small * 1.5), marginBottom: 10 }}>
                  {title}
                </Scripture>
              ) : null}
              <Scripture style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    // Nested text inherits Literata; verse numbers are set in the system face (canvas `.vn`).
                    fontFamily: "System",
                    fontSize: verseNumber.size,
                    fontWeight: "600",
                    color: palette.mutedInk,
                    fontVariant: ["tabular-nums"],
                    letterSpacing: 0,
                  }}
                >
                  {n}
                </Text>{" "}
                {own === null ? <Text style={{ color: palette.mutedInk }}>{notInLine(translation)}</Text> : <DivineText text={body} />}
              </Scripture>
            </View>
          );
        })}
      </View>
      {span !== null ? (
        <Pressable
          onPress={() => {
            log("go_deeper", from, refText);
            jumpTo({ book: span.book, chapter: span.chapter, verse: span.startVerse, from: from === "" ? undefined : from, select: true });
          }}
          accessibilityRole="button"
          accessibilityLabel={`Read ${chapterTitle(span.book, span.chapter)}`}
          testID="peek-read"
          style={({ pressed }) => [
            {
              marginTop: 20,
              minHeight: LAYOUT.minTarget + 4,
              borderRadius: 999,
              backgroundColor: palette.ink,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              columnGap: 2,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Chrome tone="paper" style={{ fontWeight: "600" }}>
            Read {chapterTitle(span.book, span.chapter)}
          </Chrome>
          <Icon name="forward" size={18} tone="paper" />
        </Pressable>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  pair: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    columnGap: 12,
    flexWrap: "wrap",
    paddingVertical: 12,
  },
});

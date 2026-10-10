/**
 * Peek before leaving (J01-10, brief §1 rule 5): the passage, how it relates,
 * the verses themselves, then `Read 1 Timothy 2` — the only control that
 * leaves the chapter. The reader then shows a return chip back to here.
 */

import { formatDisplayRef, ordToParts, parseVerseId, RelationshipSchema, verseOrd } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "../../components/Icon";
import { useSheetNav } from "../../components/navigation";
import { Section, SheetScreen } from "../../components/Sheet";
import { Chrome, Original, Prose, Scripture } from "../../components/Type";
import { useCore, useLog, useQuery } from "../../data/AppData";
import { getTextsInRange, getTokens, scriptOf } from "../../data/queries";
import { LAYOUT, usePalette } from "../../design/tokens";
import { formatRange, resolveRef } from "../../lib/chapters";
import { sameOpening } from "../../lib/echo";
import { RELATIONSHIP_LABEL } from "../../lib/evidence";
import { chapterTitle } from "../../lib/reader";
import { useSettings } from "../../state/settings";

export default function PeekScreen() {
  const params = useLocalSearchParams<{ ref?: string; from?: string; relationship?: string; note?: string; unreviewed?: string; via?: string }>();
  const refText = params.ref ?? "";
  const span = resolveRef(refText);
  const from = params.from ?? "";
  const fromRef = parseVerseId(from);
  const core = useCore();
  const log = useLog();
  const palette = usePalette();
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
      // The note comes from an entry the caller marked unreviewed.
      unreviewed={params.unreviewed === "1" && note !== null}
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
      <View style={{ marginTop: relationship !== null || note !== null ? 16 : 0 }}>
        <Scripture step="explanation">
          {(data ?? []).map((v, i) => (
            <Scripture key={v.ord} step="explanation">
              {i > 0 ? " " : ""}
              <Scripture step="explanation" tone="muted" style={{ fontSize: 13 }}>
                {`${ordToParts(v.ord).verse} `}
              </Scripture>
              {v.texts[translation] ?? v.texts.BSB ?? ""}
            </Scripture>
          ))}
        </Scripture>
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

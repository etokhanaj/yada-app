/**
 * One verse in the reader (canvas J01-01, J01-02, D-04, B-03, P-01).
 *
 * - Verse 1 carries the chapter numeral in place of its number (amendment 8),
 *   set beside the first two lines like a printed Bible's drop numeral; at AX
 *   sizes it stands on its own line (canvas `.ax5 .cn`).
 * - Selected verses: the selection wash plus a rounded 3 pt accent bar, a
 *   range drawn as one block (brief §3: never colour alone). Matter
 *   (https://mobbin.com/screens/058e54c1-2c6e-4568-939e-72ca0bd6ef85).
 * - A bookmarked verse shows a filled bookmark beside its number.
 * - A verse with an explanation ends in a small muted note glyph bound to its
 *   last word (amendment 10, YouVersion's note marker; v2-review U9).
 * - LORD in small capitals, the BSB's convention (amendment 12).
 */

import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, type TextLayoutLine, View } from "react-native";

import { FONTS, RADIUS, useAXLevel, usePalette, useType } from "../design/tokens";
import { splitDivineName, splitSuperscription, type TextSegment } from "../lib/reader";
import { Icon } from "./Icon";
import { Scripture } from "./Type";

/** Scripture text with LORD in small capitals (amendment 12), for excerpts in lists. */
export function DivineText({ text }: { text: string }) {
  return <DivineName segments={splitDivineName(text)} />;
}

/** Where this verse sits in a selected range, so the range draws as one block. */
export type SelectionPlace = "none" | "only" | "first" | "middle" | "last";

export type VerseAction = "understand" | "original" | "compare" | "copy" | "share" | "bookmark";

const WASH_INSET = 14;
const BAR_LEFT = 8;
const GAP = 14;

/** Word joiner: keeps an inline glyph on the same line as the word before it. */
const JOIN = "⁠";

function DivineName({ segments }: { segments: readonly TextSegment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.smallCaps ? (
          // Drawn as "Lord" in the font's small capitals; read as "Lord".
          <Text key={i} style={{ fontVariant: ["small-caps"], letterSpacing: 0.6 }}>
            {s.text.charAt(0) + s.text.slice(1).toLowerCase()}
          </Text>
        ) : (
          s.text
        ),
      )}
    </>
  );
}

/** Segments for characters [start, end) of their joined text. */
function sliceSegments(segments: readonly TextSegment[], start: number, end: number): TextSegment[] {
  const out: TextSegment[] = [];
  let at = 0;
  for (const s of segments) {
    const a = Math.max(start, at);
    const b = Math.min(end, at + s.text.length);
    if (a < b) out.push({ text: s.text.slice(a - at, b - at), smallCaps: s.smallCaps });
    at += s.text.length;
  }
  return out;
}

export function Verse({
  verse,
  chapter,
  text,
  place,
  bookmarked,
  hasEntry,
  onPress,
  onAction,
  testID,
}: {
  verse: number;
  chapter: number;
  text: string;
  place: SelectionPlace;
  bookmarked: boolean;
  hasEntry: boolean;
  onPress: () => void;
  onAction: (action: VerseAction) => void;
  testID?: string;
}) {
  const palette = usePalette();
  const ax = useAXLevel() >= 1;
  const scripture = useType("scripture");
  const number = useType("verseNumber");
  const selected = place !== "none";
  const opensBlock = place === "only" || place === "first";
  const closesBlock = place === "only" || place === "last";
  const { title: superscription, body } = verse === 1 ? splitSuperscription(text) : { title: null, body: text };
  const segments = splitDivineName(body);
  const small = scripture.size * 0.85;

  const marker = hasEntry ? (
    <>
      {JOIN}
      <View style={styles.inline}>
        <Icon name="note" size={14} tone="muted" strokeWidth={1.8} maxScale={2.2} />
      </View>
    </>
  ) : null;

  const numberLabel = (
    <Text
      style={{
        // Nested text inherits Literata; verse numbers are set in the system face.
        fontFamily: "System",
        fontSize: number.size,
        fontWeight: "600",
        color: palette.mutedInk,
        fontVariant: ["tabular-nums"],
        letterSpacing: 0,
      }}
    >
      {verse}
    </Text>
  );

  const bookmark = bookmarked ? (
    <>
      {JOIN}
      <View style={styles.inline}>
        <Icon name="bookmark" size={14} tone="accent" filled maxScale={2.2} />
      </View>
    </>
  ) : null;

  const label = [
    verse === 1 ? `Chapter ${chapter}, verse 1` : `Verse ${verse}`,
    bookmarked ? "bookmarked" : null,
    hasEntry ? "has an explanation" : null,
  ]
    .filter((p) => p !== null)
    .join(", ");

  const actions = [
    ...(hasEntry ? [{ name: "understand", label: "Understand" }] : []),
    { name: "original", label: "Original" },
    { name: "compare", label: "Compare" },
    { name: "copy", label: "Copy" },
    { name: "share", label: "Share" },
    { name: "bookmark", label: bookmarked ? "Remove bookmark" : "Bookmark" },
  ];

  return (
    <Pressable
      onPress={onPress}
      // iOS lists delay the highlight so a scroll that starts on a verse doesn't flash it.
      unstable_pressDelay={90}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${text}`}
      accessibilityHint={selected ? "Tap another verse to extend the selection" : "Selects this verse"}
      accessibilityActions={actions}
      onAccessibilityAction={(e) => onAction(e.nativeEvent.actionName as VerseAction)}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          paddingLeft: selected ? WASH_INSET + BAR_LEFT : WASH_INSET,
          paddingTop: opensBlock ? 10 : 0,
          paddingBottom: !selected ? 0 : closesBlock ? 10 : GAP,
          marginBottom: !selected || closesBlock ? GAP : 0,
          backgroundColor: selected ? palette.selection : pressed ? palette.fill : "transparent",
          borderTopLeftRadius: opensBlock || !selected ? RADIUS.wash : 0,
          borderTopRightRadius: opensBlock || !selected ? RADIUS.wash : 0,
          borderBottomLeftRadius: closesBlock || !selected ? RADIUS.wash : 0,
          borderBottomRightRadius: closesBlock || !selected ? RADIUS.wash : 0,
        },
      ]}
    >
      {selected ? (
        <View
          style={[
            styles.bar,
            // Middle rows overlap by a point so a range's bar reads as one stroke.
            { backgroundColor: palette.accent, top: opensBlock ? 14 : -1, bottom: closesBlock ? 14 : -1 },
          ]}
        />
      ) : null}
      {superscription !== null ? (
        <Scripture tone="muted" style={{ fontStyle: "italic", fontSize: Math.round(small), lineHeight: Math.round(small * 1.5), marginBottom: 10 }}>
          {superscription}
        </Scripture>
      ) : null}
      {verse === 1 ? (
        <ChapterOpening chapter={chapter} segments={segments} ax={ax} lineHeight={scripture.lineHeight} size={scripture.size}>
          {bookmark}
          {marker}
        </ChapterOpening>
      ) : (
        <Scripture>
          {numberLabel}
          {bookmark}
          {" "}
          <DivineName segments={segments} />
          {marker}
        </Scripture>
      )}
    </Pressable>
  );
}

/**
 * The chapter numeral beside the first two lines. React Native text cannot
 * flow around a float, so the verse is measured once at the narrower width,
 * its first two lines set beside the numeral and the rest beneath at full width.
 */
function ChapterOpening({
  chapter,
  segments,
  ax,
  size,
  lineHeight,
  children,
}: {
  chapter: number;
  segments: readonly TextSegment[];
  ax: boolean;
  size: number;
  lineHeight: number;
  children: ReactNode;
}) {
  const palette = usePalette();
  const [capWidth, setCapWidth] = useState<number | null>(null);
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const [split, setSplit] = useState<number | null>(null);
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  const capSize = Math.round(size * 3.2);
  const capBox = Math.round(capSize * 1.12);
  const capLift = Math.round(capSize * 0.02);
  // The numeral occupies exactly the two lines beside it, so the third line keeps the verse's leading.
  const capOverhang = Math.max(0, capBox - capLift - lineHeight * 2);

  const numeral = (
    <Text
      allowFontScaling={!ax}
      maxFontSizeMultiplier={1}
      onLayout={(e) => setCapWidth(e.nativeEvent.layout.width)}
      style={{
        fontFamily: FONTS.scripture,
        fontSize: capSize,
        // A full line box: React Native clips glyphs to it, so a tight one cuts the numeral's top.
        // The negative margin then sets its cap height level with the first line's.
        lineHeight: capBox,
        letterSpacing: -2,
        color: palette.ink,
        marginRight: ax ? 0 : 10,
        marginLeft: -2,
        marginTop: ax ? 0 : -capLift,
        marginBottom: ax ? 4 : -capOverhang,
      }}
    >
      {chapter}
    </Text>
  );

  if (ax) {
    return (
      <View>
        {numeral}
        <Scripture>
          <DivineName segments={segments} />
          {children}
        </Scripture>
      </View>
    );
  }

  const onLines = (lines: TextLayoutLine[]) => {
    const two = lines.slice(0, 2).reduce((n, l) => n + l.text.length, 0);
    setSplit(Math.min(two, total));
  };

  const first = split === null ? segments : sliceSegments(segments, 0, split);
  const rest = split === null ? [] : sliceSegments(segments, split, total);

  return (
    <View
      onLayout={(e) => {
        // Selecting indents the text, which moves the line break: measure again.
        const width = e.nativeEvent.layout.width;
        if (width !== rowWidth) {
          setRowWidth(width);
          setSplit(null);
        }
      }}
      style={{ minHeight: lineHeight * 2 }}
    >
      {capWidth !== null && rowWidth !== null && split === null ? (
        // Measuring pass, never seen or read.
        <Scripture
          style={[styles.measure, { width: rowWidth - capWidth - 10 }]}
          onTextLayout={(e) => onLines(e.nativeEvent.lines)}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <DivineName segments={segments} />
        </Scripture>
      ) : null}
      <View style={styles.opening}>
        {numeral}
        <Scripture style={{ flex: 1 }}>
          <DivineName segments={first} />
          {rest.length === 0 ? children : null}
        </Scripture>
      </View>
      {rest.length > 0 ? (
        <Scripture>
          <DivineName segments={rest.map((s, i) => (i === 0 ? { ...s, text: s.text.replace(/^\s+/, "") } : s))} />
          {children}
        </Scripture>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: -WASH_INSET,
    paddingRight: WASH_INSET,
  },
  bar: {
    position: "absolute",
    left: BAR_LEFT,
    width: 3,
    borderRadius: 2,
  },
  inline: {
    paddingLeft: 4,
  },
  opening: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  measure: {
    position: "absolute",
    opacity: 0,
  },
});

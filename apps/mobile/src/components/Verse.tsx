/**
 * One paragraph of the reader (RU-6, RU-7, RU-8; fresh-eyes review, approved by John 23 Oct 2026; canvas J01-01,
 * D-04, B-03, P-01, PS-02).
 *
 * - RU-6: the BSB's own paragraphs (data/paragraphs.ts), verses flowing as one block of prose with their numbers
 *   inline, small and muted; a paragraph gap between paragraphs. Every verse is still its own nested Text, so a tap
 *   on any word selects that verse.
 * - The paragraph that opens a chapter carries the chapter numeral in place of verse 1's number (amendment 8), set
 *   beside the first two lines like a printed Bible's drop numeral; at AX sizes it stands on its own line.
 * - RU-7: a highlight is a tint behind that verse's words (the palette's highlight wash), not a box around the verse;
 *   its number stays in ink at 80% (PS-02), and VoiceOver says the colour. The selected verse is the selection wash
 *   behind its words plus a 3 pt accent bar in the margin beside its lines (brief §3: never colour alone), so it
 *   reads apart from a green highlight by shape as well as colour.
 * - A bookmarked verse shows a filled bookmark after its number; a verse with the reader's note carries the accent
 *   note mark, which opens the note (44 pt target).
 * - RU-8: where readers differ on a verse, its words end in the Readers differ mark, a button of its own (44 pt with
 *   its hit slop) that opens what they say.
 * - LORD in small capitals, the BSB's convention (amendment 12). The LSV's supplied words, [in brackets], in mutedInk
 *   with their brackets; VoiceOver reads them without (lib/supplied.ts). The text is never altered.
 * - While audio reads this chapter (AU-02): verses still to come in mutedInk, the playing verse with its spoken word in
 *   the ink pill (audio/Spoken.tsx) and its number in ink; VoiceOver hears "Verse 5, playing" (AU-06).
 *
 * VoiceOver: nested Text spans can't each be an element with their own actions, so the drawn paragraph is hidden from
 * it and every verse gets a transparent element over its lines, in reading order, with the verse's label, its words
 * and its actions (Understand, Original, Compare, Copy, Share, Bookmark, Note); activating it selects the verse, as a
 * tap does. The Readers differ mark gets its own element after its verse. The elements take no touches.
 */

import type { BookCode } from "@yada/schema";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, type TextLayoutLine, useWindowDimensions, View } from "react-native";

import { FONTS, SPACE, useAXLevel, usePalette, useType } from "../design/tokens";
import type { VerseMark } from "../lib/audio/text";
import { type HighlightColor, highlightSpoken } from "../lib/highlights";
import { useReduceMotion } from "../lib/motion";
import { cutRuns, type LaidBlock, type LaidLine, type RunLength, runSpans, textLength, type VerseRect, verseRects } from "../lib/paragraphLayout";
import { splitSuperscription, type TextSegment } from "../lib/reader";
import { scriptureSegments, spokenText } from "../lib/supplied";
import { useFootprints } from "../state/footprints";
import { type SpokenFace, SpokenSegments, useVerseMark } from "./audio/Spoken";
import { Icon } from "./Icon";
import { Scripture } from "./Type";

/** Scripture text with LORD in small capitals (amendment 12), for excerpts in lists; the LSV's supplied words muted. */
export function DivineText({ text, translation = "" }: { text: string; translation?: string }) {
  return <DivineName segments={scriptureSegments(text, translation)} />;
}

export type VerseAction = "understand" | "original" | "compare" | "copy" | "share" | "bookmark" | "note";

/** The selection bar sits this far left of the text, in the gutter: it never moves the words (RU-7). */
const BAR_LEFT = -7;
const BAR_WIDTH = 3;
/** MM-04's tick sits further out, so it never touches the selection bar. */
const FOOTPRINT_LEFT = -16;

/** Word joiner: keeps an inline glyph on the same line as the word before it. */
const JOIN = "⁠";
/** A joiner and an inline view: two characters of the paragraph's text (lib/paragraphLayout.ts). */
const MARK_LENGTH = 2;

/** Read-along state for a drawn part of the verse: the mark, the face, and the part's display offset. */
interface Spoken {
  readonly mark: VerseMark;
  readonly face: SpokenFace;
  readonly offset: number;
}

function DivineName({ segments, spoken }: { segments: readonly TextSegment[]; spoken?: Spoken | null }) {
  const palette = usePalette();
  if (spoken != null) return <SpokenSegments segments={segments} mark={spoken.mark} offset={spoken.offset} face={spoken.face} />;
  return (
    <>
      {segments.map((s, i) => {
        const muted = s.supplied === true ? { color: palette.mutedInk } : null;
        // PG-10's evidence mark: ink weight and a dotted accent underline, distinct from the
        // selection wash, the comparison wash and the spoken-word mark (shape, not colour alone).
        const mark =
          s.marked === true
            ? ({ fontWeight: "600", textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: palette.accent } as const)
            : null;
        return s.smallCaps ? (
          // Drawn as "Lord" in the font's small capitals; read as "Lord".
          <Text key={i} style={[{ fontVariant: ["small-caps"], letterSpacing: 0.6 }, muted, mark]}>
            {s.text.charAt(0) + s.text.slice(1).toLowerCase()}
          </Text>
        ) : muted !== null || mark !== null ? (
          <Text key={i} style={[muted, mark]}>
            {s.text}
          </Text>
        ) : (
          s.text
        );
      })}
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
    if (a < b) out.push({ ...s, text: s.text.slice(a - at, b - at) });
    at += s.text.length;
  }
  return out;
}

/** One verse of a paragraph, as the reader passes it. */
export interface ParagraphVerse {
  readonly verse: number;
  /** Last verse when the translation bridges verses into one ("1–2"); `verse` otherwise. */
  readonly through: number;
  readonly text: string;
  readonly selected: boolean;
  readonly bookmarked: boolean;
  readonly hasEntry: boolean;
  /**
   * Readers differ on this verse (its Understand has a debate): the one marker in the text, as on
   * 1 Corinthians 14:34 in VS-03. Not on every verse Understand covers, which is nearly all of them.
   */
  readonly differs: boolean;
  /** The reader's highlight on this verse (PS-02). */
  readonly highlight: HighlightColor | null;
  /** The reader left a note on this verse (PS-02): the mark after its number opens it. */
  readonly noted: boolean;
}

/** A verse ready to draw: its words without a psalm's title, and its share of the paragraph's text. */
interface Run {
  readonly v: ParagraphVerse;
  readonly segments: readonly TextSegment[];
  /** Characters cut from the front of the verse (a psalm's title), where the spoken word's range points. */
  readonly bodyOffset: number;
  readonly length: RunLength;
}

/** Which parts of a run one drawn block holds. */
interface RunPart {
  readonly join: boolean;
  readonly prefix: boolean;
  readonly body: readonly [number, number];
  readonly suffix: boolean;
}

export function Paragraph({
  book,
  chapter,
  translation,
  verses,
  selectionContinues,
  onPress,
  onAction,
  onNote,
  onDiffers,
  onRects,
}: {
  book: BookCode;
  chapter: number;
  /** Whose text this is: the LSV's brackets are drawn and read differently. */
  translation: string;
  verses: readonly ParagraphVerse[];
  /** The selection runs on past this paragraph's last verse: its bar bridges the paragraph gap. */
  selectionContinues: boolean;
  onPress: (verse: number) => void;
  onAction: (verse: number, action: VerseAction) => void;
  onNote: (verse: number) => void;
  onDiffers: (verse: number) => void;
  /** Each verse's top and bottom in this paragraph, once laid out: the reader scrolls and measures by verse. */
  onRects: (rects: ReadonlyMap<number, VerseRect>) => void;
}) {
  const palette = usePalette();
  const ax = useAXLevel() >= 1;
  const scripture = useType("scripture");
  const opening = verses[0]?.verse === 1;
  const footprints = useFootprints((f) => (f.book === book && f.chapter === chapter ? f.verses : null));

  const first = verses[0];
  const superscription = first !== undefined && opening ? splitSuperscription(first.text).title : null;

  const runs: Run[] = verses.map((v) => {
    const body = v.verse === 1 ? splitSuperscription(v.text).body : v.text;
    const segments = scriptureSegments(body, translation);
    const marks = (v.bookmarked ? MARK_LENGTH : 0) + (v.noted ? MARK_LENGTH : 0);
    const numberLength = (v.through > v.verse ? `${v.verse}–${v.through}` : String(v.verse)).length;
    return {
      v,
      segments,
      bodyOffset: v.text.length - body.length,
      length: {
        verse: v.verse,
        // Verse 1's number is the chapter numeral, drawn outside the text; its marks follow its words.
        prefix: v.verse === 1 ? 0 : numberLength + marks + 1,
        body: segments.reduce((n, s) => n + s.text.length, 0),
        suffix: (v.verse === 1 ? marks : 0) + (v.differs ? MARK_LENGTH : 0),
      },
    };
  });
  const lengths = runs.map((r) => r.length);
  const spans = runSpans(lengths);

  // The drawn blocks' lines and tops, as onTextLayout and onLayout report them.
  const [lines, setLines] = useState<Record<string, readonly LaidLine[]>>({});
  const [tops, setTops] = useState<Record<string, number>>({});
  const [opened, setOpened] = useState<{ split: number; lead: number } | null>(null);
  // Blocks are placed inside the text's own box; a psalm's title sits above it.
  const [textTop, setTextTop] = useState(0);
  const laid = (key: string) => (e: { nativeEvent: { lines: TextLayoutLine[] } }) => {
    const next = e.nativeEvent.lines.map((l) => ({ text: l.text, y: l.y, height: l.height }));
    setLines((was) => ({ ...was, [key]: next }));
  };
  const placed = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    const y = e.nativeEvent.layout.y;
    setTops((was) => (was[key] === y ? was : { ...was, [key]: y }));
  };

  const blocks: LaidBlock[] = [];
  const add = (key: string, offset: number) => {
    const l = lines[key];
    const top = tops[key];
    if (l !== undefined && top !== undefined) blocks.push({ lines: l, offset, top: textTop + top });
  };
  if (opening && !ax && opened !== null) {
    add("before", 0);
    add("after", opened.split + opened.lead);
  } else {
    add("all", 0);
  }
  const rects = verseRects(spans, blocks);
  // Verse 1's element covers the psalm's title and the numeral above its words.
  const verseOne = opening ? rects.get(1) : undefined;
  if (verseOne !== undefined) rects.set(1, { top: 0, bottom: verseOne.bottom });
  const rectsKey = JSON.stringify([...rects]);
  useEffect(() => {
    if (rects.size > 0) onRects(rects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rectsKey]);

  const draw = (part: (r: Run, i: number) => RunPart | null) =>
    runs.map((r, i) => {
      const p = part(r, i);
      if (p === null) return null;
      return (
        <VerseRun
          key={r.v.verse}
          run={r}
          part={p}
          book={book}
          chapter={chapter}
          translation={translation}
          onPress={() => onPress(r.v.verse)}
          onNote={() => onNote(r.v.verse)}
          onDiffers={() => onDiffers(r.v.verse)}
        />
      );
    });
  const whole = (r: Run, i: number): RunPart => ({ join: i > 0, prefix: true, body: [0, r.length.body], suffix: true });

  const hidden = { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const;

  let text: ReactNode;
  if (!opening) {
    text = (
      <Scripture {...hidden} onTextLayout={laid("all")} onLayout={placed("all")}>
        {draw(whole)}
      </Scripture>
    );
  } else {
    text = (
      <ChapterOpening
        chapter={chapter}
        ax={ax}
        size={scripture.size}
        lineHeight={scripture.lineHeight}
        total={textLength(lengths)}
        measure={(width, onLines) => (
          // Measuring pass, never seen, read or touched: the same text at the width beside the numeral.
          <Scripture style={[styles.measure, { width }]} onTextLayout={(e) => onLines(e.nativeEvent.lines)} {...hidden}>
            {runs.map((r, i) => (
              <VerseRun key={r.v.verse} run={r} part={whole(r, i)} book={book} chapter={chapter} translation={translation} still />
            ))}
          </Scripture>
        )}
        signature={JSON.stringify(lengths)}
        onSplit={setOpened}
        whole={
          <Scripture {...hidden} onTextLayout={laid("all")} onLayout={placed("all")}>
            {draw(whole)}
          </Scripture>
        }
        renderBefore={(split) => {
          const cuts = cutRuns(lengths, split);
          return (
            <Scripture {...hidden} style={{ flex: 1 }} onTextLayout={laid("before")}>
              {draw((r, i) => {
                const c = cuts[i];
                if (c === undefined || (!c.joinBefore && !c.prefixBefore && c.bodyBefore === 0 && !c.suffixBefore)) return null;
                return { join: c.joinBefore, prefix: c.prefixBefore, body: [0, c.bodyBefore], suffix: c.suffixBefore };
              })}
            </Scripture>
          );
        }}
        renderAfter={(split, lead) => {
          const cuts = cutRuns(lengths, split);
          let trimmed = lead;
          return (
            <Scripture {...hidden} onTextLayout={laid("after")} onLayout={placed("after")}>
              {draw((r, i) => {
                const c = cuts[i];
                if (c === undefined || (c.suffixBefore && (i === 0 || c.joinBefore))) return null;
                // The second block starts at the left margin: the space the line broke on is not drawn again.
                let join = i > 0 && !c.joinBefore;
                let from = c.bodyBefore;
                if (trimmed > 0 && join) {
                  join = false;
                  trimmed -= 1;
                }
                if (trimmed > 0 && c.prefixBefore) {
                  from += trimmed;
                  trimmed = 0;
                }
                return { join, prefix: !c.prefixBefore, body: [from, r.length.body], suffix: !c.suffixBefore };
              })}
            </Scripture>
          );
        }}
        leadOf={(split) => leadAt(runs, lengths, split)}
        onRowLayout={(y) => setTops((was) => (was["before"] === y ? was : { ...was, before: y }))}
      />
    );
  }

  const selected = verses.filter((v) => v.selected);
  const barRects = selected.map((v) => rects.get(v.verse)).filter((r): r is VerseRect => r !== undefined);
  const lastSelected = verses[verses.length - 1]?.selected === true;
  const bar =
    barRects.length === 0
      ? null
      : {
          top: Math.min(...barRects.map((r) => r.top)),
          bottom: Math.max(...barRects.map((r) => r.bottom)) + (lastSelected && selectionContinues ? SPACE.md : 0),
        };

  return (
    <View style={styles.paragraph}>
      {superscription !== null ? (
        <Superscription text={superscription} verse={1} book={book} chapter={chapter} translation={translation} onPress={() => onPress(1)} />
      ) : null}
      <View onLayout={(e) => setTextTop(e.nativeEvent.layout.y)}>{text}</View>
      {bar !== null ? <View style={[styles.bar, { top: bar.top, height: bar.bottom - bar.top, backgroundColor: palette.accent }]} /> : null}
      {runs.map((r) => {
        const rect = rects.get(r.v.verse);
        if (rect === undefined) return null;
        return (
          <VerseTarget
            key={r.v.verse}
            v={r.v}
            rect={rect}
            lineHeight={scripture.lineHeight}
            book={book}
            chapter={chapter}
            translation={translation}
            footprint={footprints?.has(r.v.verse) === true}
            onPress={() => onPress(r.v.verse)}
            onAction={(action) => onAction(r.v.verse, action)}
            onDiffers={() => onDiffers(r.v.verse)}
          />
        );
      })}
    </View>
  );
}

/** Characters of whitespace the second block drops at the cut: the joining space, or the words' leading space. */
function leadAt(runs: readonly Run[], lengths: readonly RunLength[], split: number): number {
  const cuts = cutRuns(lengths, split);
  for (let i = 0; i < runs.length; i++) {
    const c = cuts[i];
    const r = runs[i];
    if (c === undefined || r === undefined) continue;
    if (c.suffixBefore && (i === 0 || c.joinBefore)) continue;
    if (i > 0 && !c.joinBefore) return 1;
    if (!c.prefixBefore) return 0;
    const rest = sliceSegments(r.segments, c.bodyBefore, r.length.body)
      .map((s) => s.text)
      .join("");
    return rest.match(/^\s+/)?.[0].length ?? 0;
  }
  return 0;
}

/** A psalm's title above verse 1's words: canvas `.sup`, the drawn Literata Italic, not a slanted upright. */
function Superscription({
  text,
  verse,
  book,
  chapter,
  translation,
  onPress,
}: {
  text: string;
  verse: number;
  book: BookCode;
  chapter: number;
  translation: string;
  onPress: () => void;
}) {
  const scripture = useType("scripture");
  const { fontScale } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const mark = useVerseMark(book, chapter, translation, verse);
  const small = scripture.size * 0.85;
  const weight = mark?.kind === "current" && reduceMotion ? ({ fontWeight: "600" } as const) : null;
  return (
    <Scripture
      tone="muted"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // Part of verse 1: a tap on it selects the verse.
      onPress={onPress}
      suppressHighlighting
      style={[{ fontFamily: FONTS.scriptureItalic, fontSize: Math.round(small), lineHeight: Math.round(small * 1.5), marginBottom: 10 }, weight]}
    >
      {mark === null ? (
        text
      ) : (
        <SpokenSegments
          segments={[{ text, smallCaps: false }]}
          mark={mark}
          face={{ fontFamily: FONTS.scriptureItalic, fontSize: Math.round(small) * Math.min(fontScale, scripture.maxFontSizeMultiplier), letterSpacing: scripture.tracking }}
        />
      )}
    </Scripture>
  );
}

/** One verse's spans inside a paragraph's Text: its number and marks, its words on their tint, the differ mark. */
function VerseRun({
  run,
  part,
  book,
  chapter,
  translation,
  still = false,
  onPress,
  onNote,
  onDiffers,
}: {
  run: Run;
  part: RunPart;
  book: BookCode;
  chapter: number;
  translation: string;
  /** The measuring pass: no read-along, whose pill would change the text's length. */
  still?: boolean;
  onPress?: () => void;
  onNote?: () => void;
  onDiffers?: () => void;
}) {
  const palette = usePalette();
  const scripture = useType("scripture");
  const number = useType("verseNumber");
  const reduceMotion = useReduceMotion();
  const { fontScale } = useWindowDimensions();
  const live = useVerseMark(book, chapter, translation, run.v.verse);
  const mark = still ? null : live;
  const { v } = run;
  const playing = mark?.kind === "current";
  // AU-05: under Reduce Motion the playing verse is followed by weight, not by the moving pill.
  const weight = playing && reduceMotion ? ({ fontWeight: "600" } as const) : null;
  const face: SpokenFace = {
    fontFamily: FONTS.scripture,
    fontSize: scripture.size * Math.min(fontScale, scripture.maxFontSizeMultiplier),
    letterSpacing: scripture.tracking,
  };
  // RU-7: the wash or the tint sits behind the words only, never the number or the marks.
  const wash = v.selected ? palette.selection : v.highlight !== null ? palette.highlights[v.highlight] : null;

  const numberLabel = (
    <Text
      style={{
        // Nested text inherits Literata; verse numbers are set in the system face.
        fontFamily: "System",
        fontSize: number.size,
        fontWeight: "600",
        // PS-02: on a highlight the number is ink at 80%, so the highlight is never colour alone.
        color: playing || (v.highlight !== null && !v.selected) ? palette.ink : palette.mutedInk,
        opacity: v.highlight !== null && !v.selected && !playing ? 0.8 : 1,
        fontVariant: ["tabular-nums"],
        letterSpacing: 0,
      }}
    >
      {v.through > v.verse ? `${v.verse}–${v.through}` : v.verse}
    </Text>
  );
  const bookmark = v.bookmarked ? (
    <>
      {JOIN}
      <View style={styles.inline}>
        <Icon name="bookmark" size={14} tone="accent" filled maxScale={2.2} />
      </View>
    </>
  ) : null;
  const note = v.noted ? (
    <>
      {JOIN}
      <Pressable onPress={onNote} hitSlop={12} accessible={false} style={styles.inline} testID={still ? undefined : `note-mark-${v.verse}`}>
        <Icon name="note" size={16} tone="accent" maxScale={2.2} />
      </Pressable>
    </>
  ) : null;
  // RU-8: a real button; its slop takes the 18 by 14 pt glyph past 44 pt each way. VoiceOver has it as its own element
  // (VerseTarget), so the drawn one stays out of the accessibility tree with the rest of the paragraph.
  const differs = v.differs ? (
    <>
      {JOIN}
      <Pressable onPress={onDiffers} hitSlop={15} accessible={false} style={styles.inline} testID={still ? undefined : `differs-${v.verse}`}>
        <Icon name="note" size={14} tone="muted" strokeWidth={1.8} maxScale={2.2} />
      </Pressable>
    </>
  ) : null;

  const [a, b] = part.body;
  const words = sliceSegments(run.segments, a, b);
  return (
    <>
      {part.join ? " " : null}
      {/* A scroll that starts on a verse must not flash it: the selection itself is the tap's feedback. */}
      <Text onPress={onPress} suppressHighlighting style={weight}>
        {part.prefix && v.verse !== 1 ? (
          <>
            {numberLabel}
            {bookmark}
            {note}{" "}
          </>
        ) : null}
        {words.length > 0 ? (
          <Text style={wash === null ? null : { backgroundColor: wash }}>
            <DivineName segments={words} spoken={mark === null ? null : { mark, face, offset: run.bodyOffset + a }} />
          </Text>
        ) : null}
        {part.suffix ? (
          <>
            {v.verse === 1 ? bookmark : null}
            {v.verse === 1 ? note : null}
            {differs}
          </>
        ) : null}
      </Text>
    </>
  );
}

/**
 * A verse's VoiceOver element over its lines, and the Readers differ mark's after it. Transparent and touch-through:
 * taps land on the drawn text. Activating it selects the verse, as a tap does.
 */
function VerseTarget({
  v,
  rect,
  lineHeight,
  book,
  chapter,
  translation,
  footprint,
  onPress,
  onAction,
  onDiffers,
}: {
  v: ParagraphVerse;
  rect: VerseRect;
  lineHeight: number;
  book: BookCode;
  chapter: number;
  translation: string;
  /** MM-04: this verse uses the word open over the reader; a short ink tick in the margin. */
  footprint: boolean;
  onPress: () => void;
  onAction: (action: VerseAction) => void;
  onDiffers: () => void;
}) {
  const palette = usePalette();
  const playing = useVerseMark(book, chapter, translation, v.verse)?.kind === "current";
  const label = [
    v.through > v.verse
      ? `${v.verse === 1 ? `Chapter ${chapter}, verses` : "Verses"} ${v.verse} to ${v.through}`
      : v.verse === 1
        ? `Chapter ${chapter}, verse 1`
        : `Verse ${v.verse}`,
    playing ? "playing" : null,
    v.bookmarked ? "bookmarked" : null,
    v.highlight !== null ? highlightSpoken(v.highlight) : null,
    v.noted ? "has your note" : null,
    v.differs ? "readers differ here" : null,
    footprint ? "uses this word" : null,
  ]
    .filter((p) => p !== null)
    .join(", ");
  const actions = [
    ...(v.hasEntry ? [{ name: "understand", label: "Understand" }] : []),
    { name: "original", label: "Original" },
    { name: "compare", label: "Compare" },
    { name: "copy", label: "Copy" },
    { name: "share", label: "Share" },
    { name: "bookmark", label: v.bookmarked ? "Remove bookmark" : "Bookmark" },
    { name: "note", label: v.noted ? "Open your note" : "Note" },
  ];
  const lastLine = Math.max(rect.top, rect.bottom - lineHeight);
  return (
    <>
      {footprint ? (
        <View
          style={[styles.footprint, { top: rect.top + lineHeight / 2 - 1, backgroundColor: palette.ink }]}
          accessible={false}
          testID={`footprint-${v.verse}`}
        />
      ) : null}
      <View
        style={[styles.target, { top: rect.top, height: rect.bottom - rect.top }]}
        accessible
        accessibilityRole="button"
        accessibilityState={{ selected: v.selected }}
        accessibilityLabel={`${label}. ${spokenText(v.text, translation)}`}
        accessibilityHint={v.selected ? "Tap another verse to extend the selection" : "Selects this verse"}
        accessibilityActions={actions}
        onAccessibilityAction={(e) => onAction(e.nativeEvent.actionName as VerseAction)}
        onAccessibilityTap={onPress}
        testID={`verse-${v.verse}`}
      />
      {v.differs ? (
        <View
          style={[styles.differsTarget, { top: lastLine, height: rect.bottom - lastLine }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Readers differ on verse ${v.verse}. Opens what they say`}
          onAccessibilityTap={onDiffers}
        />
      ) : null}
    </>
  );
}

/**
 * The chapter numeral beside the opening paragraph's first two lines. React Native text cannot flow around a float,
 * so the paragraph is measured once at the narrower width, its first two lines set beside the numeral and the rest
 * beneath at full width.
 */
function ChapterOpening({
  chapter,
  ax,
  size,
  lineHeight,
  total,
  signature,
  measure,
  whole,
  renderBefore,
  renderAfter,
  leadOf,
  onSplit,
  onRowLayout,
}: {
  chapter: number;
  ax: boolean;
  size: number;
  lineHeight: number;
  total: number;
  /** The text's shape: a change (a bookmark added, a new text size) measures again. */
  signature: string;
  measure: (width: number, onLines: (lines: TextLayoutLine[]) => void) => ReactNode;
  whole: ReactNode;
  renderBefore: (split: number) => ReactNode;
  renderAfter: (split: number, lead: number) => ReactNode;
  leadOf: (split: number) => number;
  onSplit: (cut: { split: number; lead: number } | null) => void;
  onRowLayout: (y: number) => void;
}) {
  const palette = usePalette();
  const [capWidth, setCapWidth] = useState<number | null>(null);
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const [cut, setCut] = useState<{ split: number; for: string } | null>(null);
  const key = `${rowWidth ?? 0}|${capWidth ?? 0}|${signature}`;
  const split = cut !== null && cut.for === key ? cut.split : null;
  const lead = split === null ? 0 : leadOf(split);
  useEffect(() => {
    onSplit(ax || split === null ? null : { split, lead });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ax, split, lead]);
  const capSize = Math.round(size * 3.2);
  const capBox = Math.round(capSize * 1.12);
  const capLift = Math.round(capSize * 0.02);
  // The numeral occupies exactly the two lines beside it, so the third line keeps the paragraph's leading.
  const capOverhang = Math.max(0, capBox - capLift - lineHeight * 2);

  const numeral = (
    <Text
      allowFontScaling={!ax}
      maxFontSizeMultiplier={1}
      accessible={false}
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
        {whole}
      </View>
    );
  }

  return (
    <View onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)} style={{ minHeight: lineHeight * 2 }}>
      {capWidth !== null && rowWidth !== null && split === null
        ? measure(rowWidth - capWidth - 10, (lines) => {
            const two = lines.slice(0, 2).reduce((n, l) => n + l.text.length, 0);
            setCut({ split: Math.min(two, total), for: key });
          })
        : null}
      <View style={styles.opening} onLayout={(e) => onRowLayout(e.nativeEvent.layout.y)}>
        {numeral}
        {split === null ? <View style={{ flex: 1 }}>{whole}</View> : renderBefore(split)}
      </View>
      {split !== null && split < total ? renderAfter(split, lead) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // RU-6: the paragraph gap, `.para`'s 16 px.
  paragraph: { marginBottom: SPACE.md },
  bar: {
    position: "absolute",
    left: BAR_LEFT,
    width: BAR_WIDTH,
    borderRadius: 2,
  },
  footprint: { position: "absolute", left: FOOTPRINT_LEFT, width: 8, height: 2 },
  target: {
    position: "absolute",
    left: 0,
    right: 0,
    pointerEvents: "none",
  },
  differsTarget: { position: "absolute", right: 0, width: 44, pointerEvents: "none" },
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
    pointerEvents: "none",
  },
});

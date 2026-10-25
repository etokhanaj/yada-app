/**
 * The chapter's end (RD-33, keeping RT-03; John approved 18 Oct 2026): one card for the next chapter, its name and
 * first passage's title, the book's chapters as a bar of chapters read, and Continue; then Understand what you read,
 * the chapter's passages by title. No confetti, no points, no praise (docs/build-10-plan.md: levels and praise
 * rejected, after Insight Timer https://mobbin.com/screens/04f7fddd-b34f-4a07-85b4-65a460096620 and TIDE
 * https://mobbin.com/screens/da4b347e-27fc-4dcf-ba96-326b48ea415e).
 *
 * The bar lights chapters read, not position ("2 of 21 chapters read"). A book of more than 30 chapters gets one
 * continuous bar, not segments (UX pass rule 4). Nothing here animates, so Reduce Motion needs no branch.
 */

import { BOOK_CODES, type BookCode, verseOrd } from "@yada/schema";
import { Pressable, StyleSheet, View } from "react-native";

import { useCore, useQuery } from "../data/AppData";
import { chapterBounds, getTexts } from "../data/queries";
import { loadPassages, useUnderstand } from "../data/understand";
import { FONTS, usePalette } from "../design/tokens";
import { bookProgress, chapterCells, progressLabel, usesSegments } from "../lib/chaptersRead";
import { passagesTouched } from "../lib/passageGuide";
import { chapterTitle, excerptOf } from "../lib/reader";
import { ListRow } from "./Page";
import { Pill } from "./Pill";
import { Chrome } from "./Type";

/** The bar: segments for a short book, one continuous bar for a long one. `lit` and `unlit` suit the ground it sits on. */
export function ChapterBar({ book, readKeys, lit, unlit, height = 4 }: { book: BookCode; readKeys: ReadonlySet<string>; lit: string; unlit: string; height?: number }) {
  const total = BOOK_CODES[book].chapters;
  const p = bookProgress(book, readKeys);
  if (!usesSegments(total)) {
    return (
      <View style={{ height, borderRadius: height / 2, backgroundColor: unlit, overflow: "hidden" }}>
        <View style={{ width: `${(p.read / total) * 100}%`, height, backgroundColor: lit }} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", columnGap: 3 }}>
      {chapterCells(book, readKeys).map((on, i) => (
        <View key={i} style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: on ? lit : unlit }} />
      ))}
    </View>
  );
}

/** The first verse of a chapter in the BSB, for RT-04's card (public domain, as the swipe's peek shows when the version is licensed). */
export function useFirstVerse(book: BookCode, chapter: number | null): string | null {
  const core = useCore();
  const { data } = useQuery(
    async () => (chapter === null ? "" : excerptOf((await getTexts(core, verseOrd(book, chapter, 1)))["BSB"] ?? "")),
    [book, chapter],
  );
  return data === undefined || data === "" ? null : data;
}

/** The card that carries the next book at the end of one (RT-04): the sheet's ground with ink text, on the forest. */
export function NextCard({ kicker, title, verse, label, onPress, testID }: { kicker: string; title: string; verse: string | null; label: string; onPress: () => void; testID: string }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.sheet, opacity: pressed ? 0.9 : 1 }]}
      testID={testID}
    >
      <Chrome step="note" tone="muted" style={{ fontWeight: "600", marginBottom: 8 }}>
        {kicker}
      </Chrome>
      <Chrome tone="ink" style={styles.nextTitle} maxFontSizeMultiplier={2}>
        {title}
      </Chrome>
      {verse === null ? null : (
        <Chrome tone="ink" numberOfLines={3} style={styles.verse} maxFontSizeMultiplier={2}>
          {verse}
        </Chrome>
      )}
    </Pressable>
  );
}

/**
 * The reader's footer close (RD-33): the next chapter's card with Continue, then Understand what you read. After a
 * book's last chapter the card is "End of John" and Continue opens RT-04. Where Today's psalms or a plan lead, the
 * reader draws their rows instead (rule 4). Passage titles come from the book's Understand file; without it the card
 * has no subtitle and the Understand row is not drawn.
 */
export function ChapterClose({
  book,
  chapter,
  readKeys,
  onNext,
  onEnd,
  onUnderstand,
}: {
  book: BookCode;
  chapter: number;
  readKeys: ReadonlySet<string>;
  onNext: (to: { book: BookCode; chapter: number }) => void;
  onEnd: () => void;
  /** Opens the guide on this chapter's first passage, by its pericope id (RD-33's Understand what you read). */
  onUnderstand?: (pericopeId: string) => void;
}) {
  const palette = usePalette();
  const last = chapter === BOOK_CODES[book].chapters;
  const nextChapter = last ? null : chapter + 1;
  const understandFile = useUnderstand((s) => s.installed[book]?.file ?? "");
  const { data: passages } = useQuery(() => loadPassages(book), [book, understandFile]);
  const here = passagesTouched(passages ?? [], ...chapterBounds(book, chapter));
  // The next chapter's first passage by its title ("Nicodemus by night"): only one that starts in that chapter.
  const opens = nextChapter === null ? undefined : passagesTouched(passages ?? [], ...chapterBounds(book, nextChapter)).find((q) => q.startOrd >= chapterBounds(book, nextChapter)[0]);
  const p = bookProgress(book, readKeys);
  const name = BOOK_CODES[book].name;
  const title = nextChapter === null ? `End of ${name}` : chapterTitle(book, nextChapter);
  const subtitle = opens?.label ?? null;
  const go = () => (nextChapter === null ? onEnd() : onNext({ book, chapter: nextChapter }));
  const first = here[0];
  return (
    <View style={styles.wrap} testID="chapter-close">
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
          Next
        </Chrome>
        <Chrome tone="ink" accessibilityRole="header" style={styles.title} maxFontSizeMultiplier={2}>
          {title}
        </Chrome>
        {subtitle === null ? null : (
          <Chrome tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Chrome>
        )}
        <View accessible accessibilityRole="image" accessibilityLabel={progressLabel(name, p)} style={styles.progress} testID="chapter-close-bar">
          <ChapterBar book={book} readKeys={readKeys} lit={palette.accent} unlit={palette.fill} />
          <Chrome step="note" tone="muted">
            {`${p.read} of ${p.total} ${p.total === 1 ? "chapter" : "chapters"} read`}
          </Chrome>
        </View>
        <Pill
          primary
          stretch
          title="Continue"
          label={nextChapter === null ? `Continue, end of ${name}` : `Continue to ${title}${subtitle === null ? "" : `, ${subtitle}`}`}
          onPress={go}
          testID={nextChapter === null ? "chapter-close-end" : "chapter-close-next"}
        />
      </View>
      {onUnderstand !== undefined && first !== undefined ? (
        <ListRow
          first
          title="Understand what you read"
          subtitle={here.map((q) => q.label).join(" · ")}
          label={`Understand what you read: ${here.map((q) => q.label).join(", ")}`}
          onPress={() => onUnderstand(first.id)}
          testID="chapter-close-understand"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 24, paddingBottom: 16, rowGap: 8 },
  // One 24 pt radius, a soft fill, no shadow (polish-2026-10-15.md): the one thing to tap at a chapter's end.
  card: { borderRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20, minHeight: 44 },
  title: { fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 36, fontWeight: "400", letterSpacing: -0.4, marginTop: 2 },
  nextTitle: { fontFamily: FONTS.scripture, fontSize: 26, lineHeight: 30, fontWeight: "600", letterSpacing: -0.4 },
  verse: { fontFamily: FONTS.scripture, fontSize: 17, lineHeight: 24, marginTop: 8 },
  progress: { rowGap: 6, marginTop: 14, marginBottom: 14 },
});

/**
 * A calm close to a chapter (canvas RT-03; John approved 18 Oct 2026): where you are in the book as a bar of chapters
 * read, and the next chapter as the one thing to tap. No confetti, no points, no praise (docs/build-10-plan.md: levels
 * and praise rejected, after Insight Timer https://mobbin.com/screens/04f7fddd-b34f-4a07-85b4-65a460096620 and TIDE
 * https://mobbin.com/screens/da4b347e-27fc-4dcf-ba96-326b48ea415e).
 *
 * The bar lights chapters read, not position ("Mark, 4 of 16 chapters read"). A book of more than 30 chapters gets one
 * continuous bar, not segments (UX pass rule 4). Nothing here animates, so Reduce Motion needs no branch.
 * The card is Yada's own forest card (Daily prayer's, DO-01): a tappable thing, 24 pt radius, no shadow.
 */

import { BOOK_CODES, type BookCode, verseOrd } from "@yada/schema";
import { Pressable, StyleSheet, View } from "react-native";

import { useCore, useQuery } from "../data/AppData";
import { getTexts } from "../data/queries";
import { FONTS, useIsDark, usePalette } from "../design/tokens";
import { type BookProgress, bookProgress, chapterCells, progressLabel, usesSegments } from "../lib/chaptersRead";
import { chapterTitle, excerptOf } from "../lib/reader";
import { Chrome } from "./Type";
import { BRAND } from "../design/palette";

const CHARTREUSE = BRAND.chartreuse;

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

/** The first verse of a chapter in the BSB, for the card (public domain, as the swipe's peek shows when the version is licensed). */
export function useFirstVerse(book: BookCode, chapter: number | null): string | null {
  const core = useCore();
  const { data } = useQuery(
    async () => (chapter === null ? "" : excerptOf((await getTexts(core, verseOrd(book, chapter, 1)))["BSB"] ?? "")),
    [book, chapter],
  );
  return data === undefined || data === "" ? null : data;
}

/** The forest card that carries the next thing (RT-03's next chapter, RT-04's next book). */
export function NextCard({
  kicker,
  title,
  verse,
  label,
  onPress,
  quiet = false,
  testID,
}: {
  kicker: string;
  title: string;
  verse: string | null;
  label: string;
  onPress: () => void;
  /** RT-04 sits on the forest itself, so its card is the sheet's ground with ink text (canvas .rtnx.lt). */
  quiet?: boolean;
  testID: string;
}) {
  const dark = useIsDark();
  const palette = usePalette();
  const bg = quiet ? palette.sheet : dark ? BRAND.forestCardDark : BRAND.forest;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, { backgroundColor: bg, opacity: pressed ? 0.9 : 1 }]}
      testID={testID}
    >
      <Chrome step="note" style={{ color: quiet ? palette.mutedInk : CHARTREUSE, fontWeight: "600", marginBottom: 8 }}>
        {kicker}
      </Chrome>
      <Chrome style={[styles.title, quiet ? { color: palette.ink } : null]} maxFontSizeMultiplier={2}>
        {title}
      </Chrome>
      {verse === null ? null : (
        <Chrome numberOfLines={quiet ? 3 : 2} style={[styles.verse, quiet ? { color: palette.ink } : null]} maxFontSizeMultiplier={2}>
          {verse}
        </Chrome>
      )}
    </Pressable>
  );
}

/**
 * The reader's footer close (RT-03): the bar, then "Next · Mark 5". After a book's last chapter the card is "End of Mark"
 * and opens RT-04. Where Today's psalms or a plan lead, the reader draws their rows instead (rule 4).
 */
export function ChapterClose({
  book,
  chapter,
  readKeys,
  onNext,
  onEnd,
}: {
  book: BookCode;
  chapter: number;
  readKeys: ReadonlySet<string>;
  onNext: (to: { book: BookCode; chapter: number }) => void;
  onEnd: () => void;
}) {
  const palette = usePalette();
  const last = chapter === BOOK_CODES[book].chapters;
  const nextChapter = last ? null : chapter + 1;
  const verse = useFirstVerse(book, nextChapter);
  const p: BookProgress = bookProgress(book, readKeys);
  const name = BOOK_CODES[book].name;
  const label = progressLabel(name, p);
  return (
    <View style={styles.wrap} testID="chapter-close">
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ rowGap: 8, marginBottom: 18 }} testID="chapter-close-bar">
        <ChapterBar book={book} readKeys={readKeys} lit={palette.accent} unlit={palette.fill} />
        <Chrome step="note" tone="muted">
          {label}
        </Chrome>
      </View>
      {nextChapter === null ? (
        <NextCard kicker="Next" title={`End of ${name}`} verse={null} label={`Next, end of ${name}`} onPress={onEnd} testID="chapter-close-end" />
      ) : (
        <NextCard
          kicker="Next"
          title={chapterTitle(book, nextChapter)}
          verse={verse}
          label={`Next, ${chapterTitle(book, nextChapter)}.${verse === null ? "" : ` ${verse}`}`}
          onPress={() => onNext({ book, chapter: nextChapter })}
          testID="chapter-close-next"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 26, paddingBottom: 16 },
  card: { borderRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 18, minHeight: 44 },
  title: { color: "#FFFFFF", fontFamily: FONTS.scripture, fontSize: 26, lineHeight: 30, fontWeight: "600", letterSpacing: -0.4 },
  verse: { color: "rgba(255,255,255,0.9)", fontFamily: FONTS.scripture, fontSize: 17, lineHeight: 24, marginTop: 8 },
});

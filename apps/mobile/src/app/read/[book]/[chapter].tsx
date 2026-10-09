/**
 * The reading surface. One chapter, one column, almost no chrome.
 *
 * Header: "‹  John 1 · BSB  Aa" — back, the contents sheet, the translation,
 * type settings. Chapter identity also sits inside the scroll as a quiet
 * centred head (e-reader convention, 0A design pass). Previous/next chapter
 * are links at the end of the text, not floating buttons.
 *
 * The reader stays mounted under every sheet it opens, so Back to reading
 * returns to the exact scroll position and selection without restoring
 * anything. The top visible verse is saved to user.db as it changes, so
 * Continue reading on Home survives a relaunch.
 */

import { BOOK_CODES, formatDisplayRef, parseVerseId } from "@yada/schema";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookChapterList } from "../../../components/BookChapterList";
import { SelectionPill, type SelectionRect } from "../../../components/SelectionPill";
import { Chrome, Label, Prose, Scripture } from "../../../components/Type";
import { useAppData, useCore, useQuery } from "../../../data/AppData";
import { getChapter, type VerseText } from "../../../data/queries";
import { listBookmarks, savePosition, toggleBookmark } from "../../../data/user";
import { FONTS, leading, SPACE, TYPE, usePalette } from "../../../design/tokens";
import { chapterFromParams, nextChapter, prevChapter, type ChapterRef } from "../../../lib/chapters";
import { EMPTY_SELECTION, formatSpan, isSelected, selectionSpan, spanRef, tapVerse } from "../../../lib/selection";
import { TRANSLATIONS, useSettings, type Translation } from "../../../state/settings";

/**
 * The back control names where it returns to, in a narrow header: "1 Cor 14:34".
 * Long book names shorten to their first three letters, as printed Bibles do.
 */
function shortRef(ref: { book: ChapterRef["book"]; chapter: number; verse: number }): string {
  const name = BOOK_CODES[ref.book].name;
  const parts = name.split(" ");
  const last = parts[parts.length - 1] ?? name;
  const short = name.length <= 6 ? name : [...parts.slice(0, -1), last.slice(0, 3)].join(" ");
  return `${short} ${ref.chapter}:${ref.verse}`;
}

function chapterTitle(ref: ChapterRef): string {
  // "Psalms 23" reads wrong; a single psalm is a Psalm.
  const name = ref.book === "PSA" ? "Psalm" : BOOK_CODES[ref.book].name;
  return `${name} ${ref.chapter}`;
}

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string; from?: string; select?: string }>();
  const ref = chapterFromParams(params.book, params.chapter);
  const { book, chapter } = ref;
  const target = params.verse === undefined ? null : Number(params.verse);
  const fromRef = params.from === undefined ? null : parseVerseId(params.from);

  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const setTranslation = useSettings((s) => s.setTranslation);

  const { data: verses } = useQuery(() => getChapter(core, book, chapter, translation), [book, chapter, translation]);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [contentsOpen, setContentsOpen] = useState(false);
  const [headerBottom, setHeaderBottom] = useState(insets.top + 44);
  const [rect, setRect] = useState<SelectionRect | null>(null);

  const listRef = useRef<FlatList<VerseText>>(null);
  const rows = useRef(new Map<number, View>());
  const scrolledFor = useRef<string | null>(null);

  // A new chapter starts with nothing selected, unless the link asked for its verse.
  useEffect(() => {
    setSelection(params.select === "1" && target !== null ? { anchor: target, end: null } : EMPTY_SELECTION);
  }, [book, chapter, target, params.select]);

  // Land on the requested verse once its chapter is on screen; once per arrival.
  useEffect(() => {
    if (verses === undefined) return;
    const arrival = `${book}.${chapter}.${String(target)}`;
    if (scrolledFor.current === arrival) return;
    scrolledFor.current = arrival;
    const index = target === null ? -1 : verses.findIndex((v) => v.verse === target);
    const timer = setTimeout(() => {
      if (index < 0) listRef.current?.scrollToOffset({ offset: 0, animated: false });
      else listRef.current?.scrollToIndex({ index, viewPosition: 0.15, animated: false });
    }, 60);
    return () => clearTimeout(timer);
  }, [verses, book, chapter, target]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      listBookmarks(user).then((rows) => {
        if (live) setBookmarks(new Set(rows.map((r) => r.verse_id)));
      });
      return () => {
        live = false;
      };
    }, [user]),
  );

  // Reading position: the first verse more than half visible, saved as it settles.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useRef({ book, chapter });
  location.current = { book, chapter };
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<VerseText>[] }) => {
    const first = viewableItems.find((v) => v.isViewable)?.item;
    if (first === undefined) return;
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { book: b, chapter: c } = location.current;
      void savePosition(user, `${b}.${c}.${first.verse}`);
    }, 400);
  }).current;

  const span = selectionSpan(selection);

  /** Measure the selected rows in window coordinates so the pill can sit beside them. */
  const measureSelection = useCallback(() => {
    if (span === null) {
      setRect(null);
      return;
    }
    const first = rows.current.get(span.start);
    const last = rows.current.get(span.end);
    if (first === undefined || last === undefined) {
      setRect(null);
      return;
    }
    first.measureInWindow((_x, top) => {
      last.measureInWindow((_x2, lastTop, _w, lastHeight) => {
        const bottom = lastTop + lastHeight;
        // Scrolled entirely out of view: no pill floating over unrelated text.
        if (bottom < headerBottom || top > window.height) setRect(null);
        else setRect({ top, bottom });
      });
    });
  }, [span?.start, span?.end, headerBottom, window.height]);

  useEffect(() => {
    const frame = requestAnimationFrame(measureSelection);
    return () => cancelAnimationFrame(frame);
  }, [measureSelection, verses]);

  const goTo = useCallback((next: ChapterRef) => {
    setContentsOpen(false);
    router.setParams({ book: next.book, chapter: String(next.chapter), verse: undefined, from: undefined, select: undefined });
  }, []);

  const selectedText = useCallback((): string => {
    if (span === null || verses === undefined) return "";
    return verses
      .filter((v) => v.verse >= span.start && v.verse <= span.end)
      .map((v) => (span.start === span.end ? v.text : `${v.verse} ${v.text}`))
      .join(" ");
  }, [span, verses]);

  const label = span === null ? "" : formatSpan(BOOK_CODES[book].name, chapter, span);
  const sheetRef = span === null ? "" : spanRef(book, chapter, span);

  function more(): void {
    if (span === null) return;
    const ids = Array.from({ length: span.end - span.start + 1 }, (_, i) => `${book}.${chapter}.${span.start + i}`);
    const allMarked = ids.every((id) => bookmarks.has(id));
    const quote = `${selectedText()}\n— ${label} (${translation})`;
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Copy", "Share", allMarked ? "Remove bookmark" : "Bookmark", "Cancel"], cancelButtonIndex: 3, title: label },
      (index) => {
        if (index === 0) {
          void Clipboard.setStringAsync(quote);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (index === 1) {
          void Share.share({ message: quote });
        } else if (index === 2) {
          void (async () => {
            for (const id of ids) {
              const marked = bookmarks.has(id);
              if (allMarked ? marked : !marked) await toggleBookmark(user, id);
            }
            const now = await listBookmarks(user);
            setBookmarks(new Set(now.map((r) => r.verse_id)));
            void Haptics.selectionAsync();
          })();
        }
      },
    );
  }

  function chooseTranslation(): void {
    const options = [...TRANSLATIONS.map((t) => `${t.code} · ${t.name}`), "Cancel"];
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, title: "Translation" }, (index) => {
      const pick = TRANSLATIONS[index];
      if (pick !== undefined) setTranslation(pick.code);
    });
  }

  const prev = prevChapter(book, chapter);
  const next = nextChapter(book, chapter);
  const translationName = TRANSLATIONS.find((t) => t.code === translation)?.name ?? translation;

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <ReaderHeader
        title={chapterTitle(ref)}
        translation={translation}
        backLabel={fromRef === null ? null : shortRef(fromRef)}
        backAccessibility={fromRef === null ? null : formatDisplayRef(fromRef)}
        onLayoutBottom={setHeaderBottom}
        onContents={() => setContentsOpen(true)}
        onTranslation={chooseTranslation}
      />

      {verses === undefined ? null : (
        <FlatList
          ref={listRef}
          data={verses}
          keyExtractor={(v) => String(v.ord)}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          initialNumToRender={40}
          windowSize={15}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onScroll={() => (span === null ? undefined : measureSelection())}
          // Text size and Dynamic Type changes move the selected rows without a
          // scroll; follow them so the pill never lands on the wrong verse.
          onContentSizeChange={() => (span === null ? undefined : requestAnimationFrame(measureSelection))}
          scrollEventThrottle={32}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Rows are variable height, so a far-off verse is not yet measured.
            // A pixel estimate lands on the wrong verse (0A: verse 7 instead of
            // 34); get close, let rows render, then ask again by index.
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.15, animated: false }), 120);
          }}
          ListHeaderComponent={
            <View style={styles.chapterHead}>
              <Label accessibilityRole="header" style={{ fontFamily: FONTS.scripture, fontSize: TYPE.chapterHead.size, letterSpacing: TYPE.chapterHead.tracking, lineHeight: leading(TYPE.chapterHead.size, TYPE.chapterHead.ratio) }}>
                {chapterTitle(ref)}
              </Label>
              <View style={[styles.rule, { backgroundColor: palette.divider }]} />
            </View>
          }
          renderItem={({ item }) => {
            const selected = isSelected(selection, item.verse);
            const verseId = `${book}.${chapter}.${item.verse}`;
            const marked = bookmarks.has(verseId);
            return (
              <View
                ref={(node) => {
                  if (node === null) rows.current.delete(item.verse);
                  else rows.current.set(item.verse, node);
                }}
                collapsable={false}
              >
                <Pressable
                  onPress={() => setSelection((s) => tapVerse(s, item.verse))}
                  style={({ pressed }) => [
                    styles.verseRow,
                    { backgroundColor: selected || pressed ? palette.selection : "transparent" },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Verse ${item.verse}${marked ? ", bookmarked" : ""}. ${item.text}`}
                  accessibilityHint={selected ? "Tap another verse to extend the selection" : "Selects this verse"}
                  testID={`verse-${item.verse}`}
                >
                  <Scripture>
                    <Scripture tone={marked ? "accent" : "muted"} style={{ fontSize: TYPE.meta.size + 1 }}>
                      {item.verse}
                      {"  "}
                    </Scripture>
                    {item.text}
                  </Scripture>
                </Pressable>
              </View>
            );
          }}
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={styles.footerLinks}>
                {prev !== null ? (
                  <Pressable onPress={() => goTo(prev)} hitSlop={8} accessibilityRole="link" testID="prev-chapter">
                    <Chrome size={16}>‹ {chapterTitle(prev)}</Chrome>
                  </Pressable>
                ) : (
                  <View />
                )}
                {next !== null ? (
                  <Pressable onPress={() => goTo(next)} hitSlop={8} accessibilityRole="link" testID="next-chapter">
                    <Chrome size={16}>{chapterTitle(next)} ›</Chrome>
                  </Pressable>
                ) : null}
              </View>
              <Prose step="note" tone="muted" style={{ textAlign: "center", marginTop: SPACE.xl }}>
                {translationName}
              </Prose>
            </View>
          }
        />
      )}

      {span !== null && rect !== null ? (
        <SelectionPill
          key={`${span.start}-${span.end}`}
          rect={rect}
          minTop={headerBottom + SPACE.xs}
          maxBottom={window.height - Math.max(insets.bottom, SPACE.md)}
          onUnderstand={() => router.push({ pathname: "/understand", params: { ref: sheetRef } })}
          onOriginal={() => router.push({ pathname: "/original", params: { ref: sheetRef } })}
          onCompare={() => router.push({ pathname: "/compare", params: { ref: sheetRef } })}
          onMore={more}
        />
      ) : null}

      <ContentsSheet
        visible={contentsOpen}
        current={ref}
        onPick={(b, c) => goTo({ book: b, chapter: c })}
        onClose={() => setContentsOpen(false)}
      />
    </View>
  );
}

function ReaderHeader({
  title,
  translation,
  backLabel,
  backAccessibility,
  onLayoutBottom,
  onContents,
  onTranslation,
}: {
  title: string;
  translation: Translation;
  backLabel: string | null;
  backAccessibility: string | null;
  onLayoutBottom: (y: number) => void;
  onContents: () => void;
  onTranslation: () => void;
}) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  return (
    <View
      style={[styles.header, { paddingTop: insets.top + SPACE.xs, backgroundColor: palette.paper }]}
      onLayout={(e) => onLayoutBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={backAccessibility === null ? "Home" : `Back to ${backAccessibility}`}
        testID="reader-back"
        style={styles.headerSide}
      >
        <Chrome size={17} numberOfLines={1}>
          ‹{backLabel === null ? "" : ` ${backLabel}`}
        </Chrome>
      </Pressable>
      <View style={styles.headerCentre}>
        <Pressable onPress={onContents} hitSlop={8} accessibilityRole="button" accessibilityHint="Opens books and chapters" testID="reader-contents">
          <Chrome size={16} tone="ink">
            {title}
          </Chrome>
        </Pressable>
        <Chrome size={16} tone="muted">
          {" · "}
        </Chrome>
        <Pressable onPress={onTranslation} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Translation, ${translation}`} testID="reader-translation">
          <Chrome size={16} tone="muted">
            {translation}
          </Chrome>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push("/type-settings")}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Text size and appearance"
        testID="reader-type"
        style={[styles.headerSide, { alignItems: "flex-end" }]}
      >
        <Chrome size={17} tone="muted" style={{ fontFamily: FONTS.scripture }}>
          Aa
        </Chrome>
      </Pressable>
    </View>
  );
}

function ContentsSheet({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: ChapterRef;
  onPick: (book: ChapterRef["book"], chapter: number) => void;
  onClose: () => void;
}) {
  const palette = usePalette();
  const scroll = useRef<ScrollView>(null);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: palette.paper }}>
        <View style={styles.sheetBar}>
          <Label>Contents</Label>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" testID="contents-done">
            <Chrome size={17}>Done</Chrome>
          </Pressable>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.xxl }}>
          <BookChapterList
            current={current}
            onPick={onPick}
            onCurrentLayout={(y) => scroll.current?.scrollTo({ y: Math.max(0, y - SPACE.md), animated: false })}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.sm,
    columnGap: SPACE.sm,
  },
  headerSide: {
    flexShrink: 1,
    maxWidth: "34%",
    minWidth: 32,
  },
  headerCentre: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  body: {
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.xxl * 2,
  },
  chapterHead: {
    alignItems: "center",
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    width: 56,
    marginTop: SPACE.md,
  },
  verseRow: {
    borderRadius: 5,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    marginHorizontal: -SPACE.sm,
    marginBottom: SPACE.sm,
  },
  footer: {
    paddingTop: SPACE.xl,
  },
  footerLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: SPACE.md,
  },
  sheetBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
});

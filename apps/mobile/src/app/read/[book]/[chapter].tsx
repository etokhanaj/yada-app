/**
 * The reading surface. One chapter, one column, chrome that steps back.
 *
 * Header: `‹ Home` (or the return chip) · the chapter title, opening Contents ·
 * `Aa`, floating glass over the text (ReaderHeader). Tapping verses selects
 * them; the action bar docks to the bottom and the selection scrolls to stay
 * above it. Chapter links are capsules at the foot.
 *
 * The reader stays mounted under every sheet it opens, so Back to reading
 * returns to the exact scroll position and selection without restoring
 * anything. The top visible verse is saved to user.db as it changes, so a
 * cold launch reopens the reader there (brief §8.18) and Continue on Home
 * points at it.
 */

import { BOOK_CODES, formatDisplayRef, formatVerseId, parseVerseId } from "@yada/schema";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";

import { ActionBar } from "../../../components/ActionBar";
import { useLaunch } from "../../../components/LaunchOverlay";
import { Icon } from "../../../components/Icon";
import { ReaderHeader } from "../../../components/ReaderHeader";
import { Chrome, Prose } from "../../../components/Type";
import { Verse, type SelectionPlace, type VerseAction } from "../../../components/Verse";
import { useAppData, useCore, useQuery } from "../../../data/AppData";
import { isLicensedCode, LICENSED } from "../../../data/licensed";
import { chapterBounds, getChapter, scriptOf, type VerseText } from "../../../data/queries";
import { licensedEnabled, useLicensedChapter } from "../../../data/useLicensedChapter";
import { loadEntryOrds, loadPericopes } from "../../../data/understand";
import { pericopeForVerse } from "../../../lib/pericopes";
import { useTranslationName } from "../../../data/translations";
import { listBookmarks, savePosition, toggleBookmark } from "../../../data/user";
import { SHEET_MEDIUM, SPACE, useLayout, usePalette } from "../../../design/tokens";
import { chapterFromParams, nextChapter, prevChapter, type ChapterRef } from "../../../lib/chapters";
import { useReduceMotion } from "../../../lib/motion";
import { barTopIn, chapterTitle, HEADER_START, headerOnScroll, scrollToClearBar, sheetTopIn, shortRef } from "../../../lib/reader";
import { EMPTY_SELECTION, formatSpan, selectionSpan, spanRef, tapVerse } from "../../../lib/selection";
import { useAccessibility } from "../../../state/accessibility";
import { useSettings } from "../../../state/settings";

function placeIn(span: { start: number; end: number } | null, verse: number): SelectionPlace {
  if (span === null || verse < span.start || verse > span.end) return "none";
  if (span.start === span.end) return "only";
  if (verse === span.start) return "first";
  if (verse === span.end) return "last";
  return "middle";
}

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string; from?: string; select?: string; resume?: string }>();
  const ref = chapterFromParams(params.book, params.chapter);
  const { book, chapter } = ref;
  const target = params.verse === undefined ? null : Number(params.verse);
  const fromRef = params.from === undefined ? null : parseVerseId(params.from);

  const palette = usePalette();
  const window = useWindowDimensions();
  const { gutter, ax } = useLayout();
  const reduceMotion = useReduceMotion();
  const screenReader = useAccessibility((s) => s.screenReader);
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const hintSeen = useSettings((s) => s.hintSeen);
  const markHintSeen = useSettings((s) => s.markHintSeen);
  // The hint is for the first visit only; once seen it never returns, even before its first tap.
  const [showHint] = useState(!hintSeen);

  // Licensed translations (dev flag only) come from API.Bible, not the core bundle (docs/licensed-translations.md).
  const licensedCode = licensedEnabled() && isLicensedCode(translation) ? translation : null;
  const licensed = useLicensedChapter(licensedCode, book, chapter);
  const { data: bundled, error: versesError } = useQuery(
    async () => (licensedCode === null ? getChapter(core, book, chapter, translation) : undefined),
    [book, chapter, translation, licensedCode],
  );
  const verses: VerseText[] | undefined =
    licensedCode === null
      ? bundled
      : licensed === undefined
        ? undefined
        : licensed.status === "ok"
          ? // A bridged verse ("[1-2]") is one row numbered 1–2 and keyed by its first verse, so
            // selecting it selects verse 1 and verse 2 has no row of its own (review, 10 Oct 2026).
            licensed.verses.map((v) => ({ ord: chapterBounds(book, chapter)[0] - 1 + v.verse, verse: v.verse, through: v.through, text: v.text }))
          : [];
  // DP-04: the passage holding verse 1 names the chapter opening.
  const { data: opener } = useQuery(
    async () => pericopeForVerse(await loadPericopes(book), chapterBounds(book, chapter)[0])?.label ?? null,
    [book, chapter],
  );
  const { data: entryOrds } = useQuery(() => loadEntryOrds(book, ...chapterBounds(book, chapter)), [book, chapter]);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [headerHeight, setHeaderHeight] = useState(110);
  const [barHeight, setBarHeight] = useState(0);
  const [header, setHeader] = useState(HEADER_START);

  const listRef = useRef<FlatList<VerseText>>(null);
  const rows = useRef(new Map<number, View>());
  const scrolledFor = useRef<string | null>(null);
  const offset = useRef(0);
  const dragging = useRef(false);

  // The launch overlay lifts once the first chapter can draw (brief §8.17). On a cold launch
  // this is the first screen whether it opened John 1 or a saved position (§8.18), so the
  // reader is the only screen that reports; Home reports only when it is left showing.
  useEffect(() => {
    if (verses !== undefined || versesError !== undefined) useLaunch.getState().markReady();
  }, [verses, versesError]);

  // A new chapter starts with nothing selected, unless the link asked for its verse.
  useEffect(() => {
    setSelection(params.select === "1" && target !== null ? { anchor: target, end: null } : EMPTY_SELECTION);
    setHeader(HEADER_START);
  }, [book, chapter, target, params.select]);

  // A resumed position (§8.18) puts its verse just below the header, where the list's own top
  // padding puts verse 1, so the reader sees the line they left; any other jump sits it a fifth
  // of the way down. Refs, because the header is measured after the first landing is scheduled
  // and onScrollToIndexFailed retries with the same placement.
  const resume = params.resume === "1";
  const placement = useRef({ resume, headerHeight });
  placement.current = { resume, headerHeight };
  const landOn = useCallback((index: number) => {
    const p = placement.current;
    listRef.current?.scrollToIndex(
      p.resume ? { index, viewPosition: 0, viewOffset: p.headerHeight + SPACE.sm, animated: false } : { index, viewPosition: 0.2, animated: false },
    );
  }, []);

  // Land on the requested verse once its chapter is on screen; once per arrival.
  useEffect(() => {
    if (verses === undefined) return;
    const arrival = `${book}.${chapter}.${String(target)}`;
    if (scrolledFor.current === arrival) return;
    scrolledFor.current = arrival;
    const index = target === null ? -1 : verses.findIndex((v) => v.verse === target);
    const timer = setTimeout(() => {
      if (index < 0) listRef.current?.scrollToOffset({ offset: 0, animated: false });
      else landOn(index);
    }, 60);
    return () => clearTimeout(timer);
  }, [verses, book, chapter, target, landOn]);

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
  const ordOf = (verse: number) => chapterBounds(book, chapter)[0] - 1 + verse;
  // A range offers Understand when any verse in it has an entry (passage Understand, J01-12).
  const hasEntry =
    span !== null &&
    entryOrds !== undefined &&
    Array.from({ length: span.end - span.start + 1 }, (_, i) => span.start + i).some((v) => entryOrds.has(ordOf(v)));

  /** Scroll so the selection sits between the header and `barTop` (window y). */
  const scrollSelectionAbove = useCallback(
    (barTop: number) => {
      if (span === null) return;
      const first = rows.current.get(span.start);
      const last = rows.current.get(span.end);
      if (first === undefined || last === undefined) return;
      first.measureInWindow((_x, top) => {
        last.measureInWindow((_x2, lastTop, _w, lastHeight) => {
          const delta = scrollToClearBar({ top, bottom: lastTop + lastHeight }, { headerBottom: headerHeight, barTop });
          if (Math.abs(delta) > 1) {
            listRef.current?.scrollToOffset({ offset: Math.max(0, offset.current + delta), animated: !reduceMotion });
          }
        });
      });
    },
    [span?.start, span?.end, headerHeight, reduceMotion],
  );

  /** Brief §4: the selected verse scrolls to stay above the bar. */
  const keepSelectionVisible = useCallback(() => {
    const barTop = barTopIn(window.height, barHeight);
    if (barTop !== null) scrollSelectionAbove(barTop);
  }, [scrollSelectionAbove, barHeight, window.height]);

  useEffect(() => {
    const frame = requestAnimationFrame(keepSelectionVisible);
    return () => cancelAnimationFrame(frame);
  }, [keepSelectionVisible]);

  const goTo = useCallback((next: ChapterRef) => {
    router.setParams({ book: next.book, chapter: String(next.chapter), verse: undefined, from: undefined, select: undefined, resume: undefined });
  }, []);

  const label = span === null ? "" : formatSpan(BOOK_CODES[book].name, chapter, span);
  const sheetRef = span === null ? "" : spanRef(book, chapter, span);
  const verseLabel = span === null ? "" : span.start === span.end ? `${chapter}:${span.start}` : `${chapter}:${span.start}–${span.end}`;
  const ids = span === null ? [] : Array.from({ length: span.end - span.start + 1 }, (_, i) => formatVerseId(book, chapter, span.start + i));
  const allMarked = ids.length > 0 && ids.every((id) => bookmarks.has(id));

  const selectedText = (): string => {
    if (span === null || verses === undefined) return "";
    return verses
      .filter((v) => v.verse >= span.start && v.verse <= span.end)
      .map((v) => (span.start === span.end ? v.text : `${v.verse} ${v.text}`))
      .join(" ");
  };

  /**
   * Amendment 1: at the medium detent the verse stays visible above Understand.
   * Before the sheet rises, scroll the selection into the space it leaves (the
   * top 45% of the screen); at AX sizes the sheet opens large and covers it anyway.
   */
  const clearForSheet = () => {
    if (!ax) scrollSelectionAbove(sheetTopIn(window.height, SHEET_MEDIUM));
  };

  // Original and Compare open Understand at that section: one depth-1 surface, never three (brief §1 rule 1).
  const open = (section?: "original" | "compare") => {
    clearForSheet();
    router.push({ pathname: "/understand", params: section === undefined ? { ref: sheetRef } : { ref: sheetRef, section } });
  };

  async function act(action: string): Promise<void> {
    // Menu items and VoiceOver actions both arrive by lowercase id.
    const quote = `${selectedText()}\n— ${label} (${translation})`;
    if (action === "copy") {
      await Clipboard.setStringAsync(quote);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (action === "share") {
      void Share.share({ message: quote });
    } else if (action === "original") {
      open("original");
    } else if (action === "compare") {
      open("compare");
    } else if (action === "understand") {
      open();
    } else {
      for (const id of ids) {
        const marked = bookmarks.has(id);
        if (allMarked ? marked : !marked) await toggleBookmark(user, id);
      }
      const now = await listBookmarks(user);
      setBookmarks(new Set(now.map((r) => r.verse_id)));
      void Haptics.selectionAsync();
    }
  }

  const tap = (verse: number) => {
    setSelection((s) => tapVerse(s, verse));
    void Haptics.selectionAsync();
    if (!hintSeen) markHintSeen();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    offset.current = y;
    // VoiceOver on: the header never steps back, so its title stays one swipe away.
    setHeader((h) => headerOnScroll(h, y, dragging.current && !screenReader));
  };

  const prev = prevChapter(book, chapter);
  const next = nextChapter(book, chapter);
  // A licensed version is named by its own list; every other code, built in or downloaded, by the store.
  const storedName = useTranslationName(translation);
  const translationName = LICENSED.find((t) => t.code === translation)?.name ?? storedName;
  const title = chapterTitle(book, chapter);

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      {verses === undefined ? null : (
        <FlatList
          ref={listRef}
          data={verses}
          keyExtractor={(v) => String(v.ord)}
          contentContainerStyle={{
            paddingTop: headerHeight + SPACE.sm,
            paddingHorizontal: gutter,
            paddingBottom: Math.max(barHeight, SPACE.xxl) + SPACE.lg,
          }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={40}
          windowSize={15}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onScroll={onScroll}
          onScrollBeginDrag={() => (dragging.current = true)}
          onMomentumScrollEnd={() => (dragging.current = false)}
          onScrollEndDrag={(e) => {
            if (e.nativeEvent.velocity === undefined || Math.abs(e.nativeEvent.velocity.y) < 0.01) dragging.current = false;
          }}
          scrollEventThrottle={16}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Rows are variable height, so a far-off verse is not yet measured.
            // A pixel estimate lands on the wrong verse (0A: verse 7 instead of
            // 34); get close, let rows render, then ask again by index.
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            setTimeout(() => landOn(index), 120);
          }}
          ListHeaderComponent={
            <>
              {showHint ? (
                <Prose step="note" tone="muted" style={{ marginBottom: 20 }} testID="reader-hint">
                  Tap a verse to see what it meant.
                </Prose>
              ) : null}
              {opener != null ? (
                // Literata small caps, tracked, above the numeral (DP-04, brief §8.14).
                <Chrome
                  tone="muted"
                  accessibilityRole="header"
                  style={{ fontFamily: "Literata", fontVariant: ["small-caps"], fontSize: 17, letterSpacing: 1.5, marginTop: 2, marginBottom: 14 }}
                  maxFontSizeMultiplier={2.35}
                  testID="chapter-opener"
                >
                  {opener.toLowerCase()}
                </Chrome>
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <View
              ref={(node) => {
                if (node === null) rows.current.delete(item.verse);
                else rows.current.set(item.verse, node);
              }}
              collapsable={false}
            >
              <Verse
                verse={item.verse}
                through={item.through}
                chapter={chapter}
                text={item.text}
                translation={translation}
                place={placeIn(span, item.verse)}
                bookmarked={bookmarks.has(`${book}.${chapter}.${item.verse}`)}
                hasEntry={entryOrds?.has(item.ord) ?? false}
                onPress={() => tap(item.verse)}
                onAction={(action: VerseAction) => {
                  setSelection({ anchor: item.verse, end: null });
                  void act(action);
                }}
                testID={`verse-${item.verse}`}
              />
            </View>
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <View style={styles.links}>
                {prev !== null ? (
                  <ChapterLink direction="prev" title={chapterTitle(prev.book, prev.chapter)} onPress={() => goTo(prev)} />
                ) : (
                  <View />
                )}
                {next !== null ? (
                  <ChapterLink direction="next" title={chapterTitle(next.book, next.chapter)} onPress={() => goTo(next)} />
                ) : null}
              </View>
              <Prose step="note" tone="muted" style={{ marginTop: 14 }}>
                {translationName}
              </Prose>
              {licensed?.status === "needs-connection" ? (
                <Prose step="note" tone="muted" style={{ marginTop: 6 }} testID="licensed-needs-connection">
                  Needs a connection
                </Prose>
              ) : null}
              {licensed?.status === "error" || licensed?.status === "disabled" ? (
                // Review, 10 Oct 2026: these drew an empty chapter with no word of why.
                <Prose step="note" tone="muted" style={{ marginTop: 6 }} testID="licensed-error">
                  {`Couldn't load ${licensed.translation}. Try again later.`}
                </Prose>
              ) : null}
              {licensed?.status === "ok" ? (
                // API.Bible §7: the rights holder's notice, verbatim.
                <Prose step="note" tone="muted" style={{ marginTop: 6 }} testID="licensed-notice">
                  {licensed.copyright}
                </Prose>
              ) : null}
            </View>
          }
        />
      )}

      <ReaderHeader
        title={title}
        translation={translation}
        back={fromRef === null ? null : { label: shortRef(fromRef), accessibility: formatDisplayRef(fromRef) }}
        collapsed={header.collapsed}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        onContents={() => router.push({ pathname: "/contents", params: { book, chapter: String(chapter) } })}
        onType={() => router.push("/type-settings")}
        onExpand={() => setHeader((h) => ({ ...h, collapsed: false }))}
        onHeight={setHeaderHeight}
      />

      {span !== null ? (
        <ActionBar
          verseLabel={verseLabel}
          hasEntry={hasEntry}
          bookmarked={allMarked}
          script={scriptOf(book)}
          onUnderstand={() => open()}
          onOriginal={() => open("original")}
          onCompare={() => open("compare")}
          onMenu={(action) => void act(action)}
          onHeight={setBarHeight}
        />
      ) : null}

    </View>
  );
}

function ChapterLink({ direction, title, onPress }: { direction: "prev" | "next"; title: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${direction === "prev" ? "Previous" : "Next"} chapter, ${title}`}
      testID={`${direction}-chapter`}
      style={({ pressed }) => [
        styles.link,
        direction === "prev" ? { paddingLeft: 10, paddingRight: 16 } : { paddingLeft: 16, paddingRight: 10 },
        { backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {direction === "prev" ? <Icon name="back" size={18} tone="muted" /> : null}
      <Chrome tone="ink" size={15} style={{ fontWeight: "500" }}>
        {title}
      </Chrome>
      {direction === "next" ? <Icon name="forward" size={18} tone="muted" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  links: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  link: {
    minHeight: 44,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
  },
});

/**
 * The reading surface. One chapter, one column, chrome that steps back.
 *
 * Header: `‹ Home` (or the return chip) · the chapter title, opening Contents ·
 * `Aa`, floating glass over the text (ReaderHeader). Tapping verses selects
 * them; the action bar docks to the bottom and the selection scrolls to stay
 * above it. Chapter links are capsules at the foot.
 *
 * A passage's title stands above its first verse and opens its guide (PG-01);
 * with nothing selected the bar offers the passage on screen (IA-04).
 *
 * The reader stays mounted under every sheet it opens, so Back to reading
 * returns to the exact scroll position and selection without restoring
 * anything. The top visible verse is saved to user.db as it changes, so a
 * cold launch reopens the reader there (brief §8.18) and Continue on Home
 * points at it.
 *
 * Audio (AU-01–03): with nothing selected the bar offers the passage's
 * Understand and Listen; while audio plays it is the mini player, and a
 * selection's bar adds Play from. The playing verse follows the voice to 30%
 * from the top (a snap under Reduce Motion), unless the reader dragged in the
 * last 4 s, has a verse selected, or has a sheet over the reader.
 */

import { BOOK_CODES, type BookCode, formatDisplayRef, formatVerseId, ordToParts, parseVerseId } from "@yada/schema";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
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

import { ActionBar, RestBar } from "../../../components/ActionBar";
import { ListenButton, MiniPlayer } from "../../../components/audio/ReaderBars";
import { useVerseMark } from "../../../components/audio/Spoken";
import { useLaunch } from "../../../components/LaunchOverlay";
import { Icon } from "../../../components/Icon";
import { ReaderHeader } from "../../../components/ReaderHeader";
import { Chrome, Prose } from "../../../components/Type";
import { Verse, type SelectionPlace, type VerseAction } from "../../../components/Verse";
import { useAppData, useCore, useQuery } from "../../../data/AppData";
import { isLicensedCode, LICENSED } from "../../../data/licensed";
import { chapterBounds, getChapter, scriptOf, type VerseText } from "../../../data/queries";
import { licensedEnabled, useLicensedChapter } from "../../../data/useLicensedChapter";
import { ensureStudy, loadStudyOrds, useStudy } from "../../../data/study";
import { loadEntryOrds, loadPericopes } from "../../../data/understand";
import { pericopeForVerse, type PericopeRow } from "../../../lib/pericopes";
import { rangeInBook } from "../../../lib/saved";
import { useGuide } from "../../../state/guide";
import { useTranslationName } from "../../../data/translations";
import { listBookmarks, savePosition, toggleBookmark } from "../../../data/user";
import { listen, next as nextVerse, previous as previousVerse, toggle as togglePlay } from "../../../data/audio";
import { canSpeak } from "../../../lib/audio/session";
import { currentVerse, useAudio } from "../../../state/audio";
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
  const params = useLocalSearchParams<{
    book?: string;
    chapter?: string;
    verse?: string;
    from?: string;
    select?: string;
    /** With select: the range's last verse (navigation.ts ReaderTarget.to). */
    to?: string;
    resume?: string;
    /** A pericope id: open that passage's guide over the text on arrival (Start here, Home's Next). */
    guide?: string;
  }>();
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
  // Names this reader to the guide it opens, so a guide's Next moves this reader only (state/guide.ts).
  const readerId = useRef(`reader-${Math.random().toString(36).slice(2)}`).current;
  // This screen's own navigation: router.setParams acts on the focused route, which is the
  // guide's while a guide is open, so the follow below would move the sheet, not the text.
  const navigation = useNavigation<{ setParams: (params: Record<string, string | undefined>) => void }>();

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
  const { data: pericopes } = useQuery(() => loadPericopes(book), [book]);
  // PG-01: each passage's title above its first verse, mid-chapter too (edge case 5).
  const starts = new Map<number, PericopeRow>((pericopes ?? []).map((p) => [p.start_ord, p]));
  // DP-04: a chapter that opens inside a passage (John 16 in 15:18–16:4) still names it, quietly,
  // in small capitals; a title button there would claim the passage starts here.
  const holding = pericopes === undefined ? null : pericopeForVerse(pericopes, chapterBounds(book, chapter)[0]);
  const opener = holding !== null && !starts.has(chapterBounds(book, chapter)[0]) ? holding.label : null;
  const { data: entryOrds } = useQuery(() => loadEntryOrds(book, ...chapterBounds(book, chapter)), [book, chapter]);
  // Study notes come down on their own the first time a book opens while online (canvas SN
  // brief 4), and a verse with a note offers Understand like one with an entry (brief 5), so a
  // See also target such as John 3:19–20 always has something to open.
  const studyFile = useStudy((s) => s.installed[book]?.file ?? "");
  useEffect(() => {
    void ensureStudy(user, book);
  }, [user, book]);
  // People match against the BSB text whatever the reader is reading, as Understand matches them.
  const { data: studyOrds } = useQuery(
    async () => loadStudyOrds(book, ...chapterBounds(book, chapter), await getChapter(core, book, chapter, "BSB")),
    [book, chapter, studyFile],
  );
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [headerHeight, setHeaderHeight] = useState(110);
  const [barHeight, setBarHeight] = useState(0);
  const [header, setHeader] = useState(HEADER_START);
  // The ord of the first verse below the header, once the list has settled.
  const [topVerse, setTopVerse] = useState<number | null>(null);
  const voice = useAudio((s) => s.voice);
  const session = useAudio((s) => s.session);
  const playingHere =
    session !== null && session.book === book && session.chapter === chapter && session.translation === translation && session.status !== "finished";
  const playingVerse = session === null ? undefined : currentVerse(session)?.verse;
  const focused = useRef(true);
  const draggedAt = useRef(0);

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
    const to = params.to === undefined ? null : Number(params.to);
    setSelection(params.select === "1" && target !== null ? { anchor: target, end: to !== null && to > target ? to : null } : EMPTY_SELECTION);
    setHeader(HEADER_START);
    setTopVerse(null);
  }, [book, chapter, target, params.select, params.to]);

  const openGuide = useCallback(
    (pericopeId: string) => router.push({ pathname: "/guide", params: { ref: pericopeId, reader: readerId } }),
    [readerId],
  );

  // Start here and Home's Next arrive with the passage to guide: its text lands first, then the
  // guide rises over it (ON-02), so × closes onto the passage (ON-03). Once per arrival.
  const guidedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = params.guide;
    if (id === undefined || id === "" || verses === undefined) return;
    const arrival = `${book}.${chapter}.${id}`;
    if (guidedFor.current === arrival) return;
    guidedFor.current = arrival;
    navigation.setParams({ guide: undefined });
    openGuide(id);
  }, [params.guide, verses, book, chapter, openGuide, navigation]);

  // The guide's Next moved on a passage: follow it under the sheet (state/guide.ts).
  useEffect(
    () =>
      useGuide.subscribe(({ follow }) => {
        if (follow === null || follow.reader !== readerId) return;
        useGuide.getState().setFollow(null);
        // Landed as a resumed place, the passage's first verse at the top: the reading place saved
        // from it is then that passage's, not the end of the one before (it sat a fifth down).
        navigation.setParams({ book: follow.book, chapter: String(follow.chapter), verse: String(follow.verse), from: undefined, select: undefined, resume: "1" });
      }),
    [readerId, navigation],
  );

  // ON-03: the hint counts as seen once the reader has had it on screen, not when a guide
  // opened over it at once (Start here) or the app was killed under one (edge case 7).
  useFocusEffect(
    useCallback(() => {
      if (!showHint) return;
      const timer = setTimeout(() => useSettings.getState().markHintSeen(), 1500);
      return () => clearTimeout(timer);
    }, [showHint]),
  );

  // A resumed position (§8.18) puts its verse just below the header, where the list's own top
  // padding puts verse 1, so the reader sees the line they left; any other jump sits it a fifth
  // of the way down. Refs, because the header is measured after the first landing is scheduled
  // and onScrollToIndexFailed retries with the same placement.
  // At AX sizes the header is taller than a fifth of the screen, so a jump lands just below it
  // too, or the verse's opening lines sit under the header (canvas SN-07 AX5).
  const resume = params.resume === "1";
  const placement = useRef({ resume, headerHeight, ax });
  placement.current = { resume, headerHeight, ax };
  const landOn = useCallback((index: number) => {
    const p = placement.current;
    listRef.current?.scrollToIndex(
      p.resume || p.ax ? { index, viewPosition: 0, viewOffset: p.headerHeight + SPACE.sm, animated: false } : { index, viewPosition: 0.2, animated: false },
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
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );

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

  // Reading position: the first verse whose middle is below the header, saved as it settles.
  // FlatList counts a verse under the floating header as visible, so a passage's title row
  // scrolled to the top still reported the passage before it (simulator, 11 Oct 2026): the bar
  // at rest offered 1:1–18 above 1:19, and Home's Continue pointed into a finished passage.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useRef({ book, chapter });
  location.current = { book, chapter };
  const headerBottom = useRef(headerHeight);
  headerBottom.current = headerHeight;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<VerseText>[] }) => {
    const visible = viewableItems.filter((v) => v.isViewable).map((v) => v.item);
    if (visible.length === 0) return;
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        let top = visible[0];
        for (const item of visible) {
          const node = rows.current.get(item.verse);
          if (node === undefined) continue;
          const mid = await new Promise<number>((resolve) => node.measureInWindow((_x, y, _w, h) => resolve(y + h / 2)));
          if (mid > headerBottom.current) {
            top = item;
            break;
          }
        }
        if (top === undefined) return;
        const { book: b, chapter: c } = location.current;
        // The chapter changed while the rows were measured: they are the old chapter's, and would
        // save its verse number under the new one (gate review, 11 Oct 2026).
        const at = ordToParts(top.ord);
        if (at.book !== b || at.chapter !== c) return;
        setTopVerse(top.ord);
        void savePosition(user, `${b}.${c}.${top.verse}`);
      })();
    }, 400);
  }).current;

  const span = selectionSpan(selection);
  const ordOf = (verse: number) => chapterBounds(book, chapter)[0] - 1 + verse;
  // A range offers Understand when any verse in it has an entry (passage Understand, J01-12).
  const hasEntry =
    span !== null &&
    Array.from({ length: span.end - span.start + 1 }, (_, i) => span.start + i).some(
      (v) => entryOrds?.has(ordOf(v)) === true || studyOrds?.has(ordOf(v)) === true,
    );

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

  // The playing verse sits 30% from the top as it starts (refs_au), only when nothing else
  // claims the scroll: no recent drag, no selection, no sheet over the reader.
  useEffect(() => {
    if (!playingHere || playingVerse === undefined || verses === undefined) return;
    if (!focused.current || span !== null || Date.now() - draggedAt.current < 4000) return;
    const index = verses.findIndex((v) => v.verse === playingVerse);
    // At AX sizes a verse can outgrow the screen; its first line goes under the header instead.
    if (index >= 0) listRef.current?.scrollToIndex(ax ? { index, viewPosition: 0, viewOffset: headerHeight + SPACE.sm, animated: !reduceMotion } : { index, viewPosition: 0.3, animated: !reduceMotion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingHere, playingVerse]);

  // The voice went on into the next chapter: the reader that was showing the last one follows it.
  const lastSessionChapter = useRef<{ book: BookCode; chapter: number } | null>(null);
  useEffect(() => {
    const was = lastSessionChapter.current;
    lastSessionChapter.current = session === null ? null : { book: session.book, chapter: session.chapter };
    if (session === null || was === null || session.status !== "playing" || !focused.current) return;
    if (was.book === book && was.chapter === chapter && session.book === book && session.chapter === chapter + 1) {
      router.setParams({ book, chapter: String(session.chapter), verse: undefined, from: undefined, select: undefined, resume: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.book, session?.chapter]);

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

  // IA-04: at rest the bar offers the passage on screen; it steps back with the header (D-05).
  const restPassage =
    pericopes === undefined || verses === undefined || verses.length === 0
      ? null
      : pericopeForVerse(pericopes, topVerse ?? verses[0]?.ord ?? chapterBounds(book, chapter)[0]);
  const restRange = restPassage === null ? "" : rangeInBook(restPassage.pericope_id);

  const prev = prevChapter(book, chapter);
  const next = nextChapter(book, chapter);
  // A licensed version is named by its own list; every other code, built in or downloaded, by the store.
  const storedName = useTranslationName(translation);
  const translationName = LICENSED.find((t) => t.code === translation)?.name ?? storedName;
  const title = chapterTitle(book, chapter);
  // Listen starts at the verse at the top of the screen (AU-01).
  const listenFrom = topVerse === null ? (verses?.[0]?.verse ?? 1) : topVerse % 1000;
  // The mini player can name a session in another book only from that book's passages.
  const pericopesOf = (b: BookCode) => (b === book ? (pericopes ?? []) : []);
  const ordOfVerse = (s: NonNullable<typeof session>) => currentVerse(s)?.ord ?? 0;
  const sessionName = useTranslationName(session?.translation ?? translation);
  const canListen = voice !== null && canSpeak(translation) && verses !== undefined && verses.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }} onMagicTap={session === null ? undefined : togglePlay}>
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
          onScrollBeginDrag={() => {
            dragging.current = true;
            draggedAt.current = Date.now();
          }}
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
              {opener !== null ? (
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
          renderItem={({ item, index }) => {
            const start = starts.get(item.ord);
            return (
            <>
            {start !== undefined ? (
              <PassageTitle pericope={start} book={BOOK_CODES[book].name} onPress={() => openGuide(start.pericope_id)} />
            ) : null}
            {index === 0 && showHint ? (
              // ON-03: under the passage title, above the text; shown once (settings.hintSeen).
              <Prose step="note" tone="muted" style={{ marginBottom: 20 }} testID="reader-hint">
                Tap a verse to see what it meant.
              </Prose>
            ) : null}
            <View
              ref={(node) => {
                if (node === null) rows.current.delete(item.verse);
                else rows.current.set(item.verse, node);
              }}
              collapsable={false}
            >
              <PlayingVerse
                book={book}
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
            </>
            );
          }}
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
          playFrom={
            // IA-05 draws `▶ 1:1` on a selected verse before anything plays, not only while a
            // session is on (AU-03): Play from is how a verse starts the audio (QA, 11 Oct 2026).
            !canListen
              ? null
              : () => {
                  // The bar goes back to being the player once the jump is made.
                  setSelection(EMPTY_SELECTION);
                  void listen(book, chapter, span.start);
                }
          }
        />
      ) : session !== null && (session.status === "playing" || (session.book === book && session.chapter === chapter)) ? (
        <MiniPlayer
          title={pericopeForVerse(pericopesOf(session.book), ordOfVerse(session))?.label ?? chapterTitle(session.book, session.chapter)}
          detail={`Verse ${playingVerse ?? 1} · ${session.translation}`}
          accessibility={`${pericopeForVerse(pericopesOf(session.book), ordOfVerse(session))?.label ?? chapterTitle(session.book, session.chapter)}, ${formatDisplayRef({ book: session.book, chapter: session.chapter, verse: playingVerse ?? 1 })}, ${sessionName}. Opens the player`}
          playing={session.status === "playing"}
          onOpen={() => router.push("/player")}
          onPrevious={previousVerse}
          onToggle={togglePlay}
          onNext={nextVerse}
          onHeight={setBarHeight}
        />
      ) : (restPassage !== null || canListen) && !header.collapsed ? (
        // IA-04/AU-01: the passage's guide, then Listen; the bar steps back with the header (D-05).
        <RestBar
          passage={
            restPassage === null
              ? null
              : {
                  range: restRange,
                  label: `${restPassage.label}, ${BOOK_CODES[book].name} ${restRange.replace("–", " to ")}`,
                  onUnderstand: () => openGuide(restPassage.pericope_id),
                }
          }
          audio={
            canListen ? (
              <ListenButton
                onListen={() => void listen(book, chapter, listenFrom)}
                alone={restPassage === null}
                // AU-01: VoiceOver hears what Listen reads, "Listen to The Word became flesh, John 1:1–18".
                label={
                  restPassage === null
                    ? `Listen to ${chapterTitle(book, chapter)}`
                    : `Listen to ${restPassage.label}, ${BOOK_CODES[book].name} ${restRange.replace("–", " to ")}`
                }
              />
            ) : null
          }
          onHeight={setBarHeight}
        />
      ) : null}

    </View>
  );
}

/** A verse row that follows the read-along: only the playing verse re-renders as words go by. */
function PlayingVerse({ book, ...props }: Omit<ComponentProps<typeof Verse>, "mark"> & { book: BookCode }) {
  const mark = useVerseMark(book, props.chapter, props.translation, props.verse);
  return <Verse {...props} mark={mark} />;
}

/**
 * PG-01: the passage's title above its first verse, in Literata semibold with
 * a quiet chevron; it opens the passage's guide. One element to VoiceOver,
 * read before the verse it heads.
 */
function PassageTitle({ pericope, book, onPress }: { pericope: PericopeRow; book: string; onPress: () => void }) {
  const range = rangeInBook(pericope.pericope_id);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pericope.label}, ${book} ${range.replace("–", " to ")}. Opens the passage guide`}
      testID={`passage-title-${pericope.pericope_id}`}
      style={({ pressed }) => [styles.passageTitle, pressed ? { opacity: 0.6 } : null]}
    >
      <Chrome tone="ink" style={styles.passageTitleText} maxFontSizeMultiplier={1.8}>
        {pericope.label}
      </Chrome>
      <Icon name="forward" size={16} tone="muted" />
    </Pressable>
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
  passageTitle: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    minHeight: 44,
    marginBottom: 6,
  },
  passageTitleText: {
    fontFamily: "Literata",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
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

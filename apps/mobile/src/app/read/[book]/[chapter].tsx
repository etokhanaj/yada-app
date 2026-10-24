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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
import { ChapterClose } from "../../../components/ChapterClose";
import { BookWelcome, ChapterPeek, EndOfBook } from "../../../components/ChapterPages";
import type { BookIntro } from "../../../lib/bookIntro";
import { MissingVerseLines } from "../../../components/OmittedVerse";
import { ListRow } from "../../../components/Page";
import { loadMcheyne, loadYourPlan, markPortionRead, type McheyneState } from "../../../data/plans";
import { keyOf, MCHEYNE_READINGS, nextPortion, portionLabel, portionsInChapter, portionSpoken } from "../../../lib/plans";
import { ChapterSwipe } from "../../../components/ChapterSwipe";
import { ListenButton, MiniPlayer, NowPlayingStrip } from "../../../components/audio/ReaderBars";
import { useLaunch } from "../../../components/LaunchOverlay";
import { Icon } from "../../../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AboutHandle, useBookIntro } from "../../../components/AboutHandle";
import { ReaderHeader } from "../../../components/ReaderHeader";
import { ProphetLeadLines, PsalmLeadLines, PsalmTip } from "../../../components/ReaderLeads";
import { Chrome, Prose } from "../../../components/Type";
import { Paragraph, type VerseAction } from "../../../components/Verse";
import { useAppData, useCore, useQuery } from "../../../data/AppData";
import { isLicensedCode, LICENSED } from "../../../data/licensed";
import { isParagraphStart } from "../../../data/paragraphs";
import { chapterBounds, getChapter, getLanguageLetters, scriptOf, type VerseText } from "../../../data/queries";
import { originalLanguage } from "../../../lib/originalLanguage";
import { licensedEnabled, useLicensedChapter } from "../../../data/useLicensedChapter";
import { ensureStudy, loadStudyOrds, useStudy } from "../../../data/study";
import { asPericope, ensureUnderstand, loadBookIntro, loadChapterUnderstand, loadPassages, useUnderstand } from "../../../data/understand";
import { pericopeForVerse, type PericopeRow } from "../../../lib/pericopes";
import { prophetLeads, readerLeadLines } from "../../../lib/passageGuide";
import { groupParagraphs, type VerseRect } from "../../../lib/paragraphLayout";
import { rangeInBook } from "../../../lib/saved";
import { useGuide } from "../../../state/guide";
import { useTranslationName } from "../../../data/translations";
import {
  countDay,
  listBookmarks,
  loadChapterNotes,
  loadChaptersRead,
  loadHighlights,
  loadSettings,
  markBookBegun,
  markChapterRead,
  markPassageRead,
  savePosition,
  setHighlight,
  subscribeYourSpace,
  toggleBookmark,
} from "../../../data/user";
import type { HighlightColor } from "../../../lib/highlights";
import { shouldAsk } from "../../../data/reminder";
import { bookThread, readThread, stepAfter } from "../../../lib/startHere";
import { audioTranslation, endSession, listen, next as nextVerse, previous as previousVerse, toggle as togglePlay } from "../../../data/audio";
import { currentVerse, useAudio } from "../../../state/audio";
import { progressSegments } from "../../../lib/audio/session";
import { spokenText } from "../../../lib/supplied";
import { SHEET_MEDIUM, SPACE, useLayout, usePalette, WIDE } from "../../../design/tokens";
import { chapterKey } from "../../../lib/chaptersRead";
import { chapterFromParams, nextChapter, prevChapter, type ChapterRef } from "../../../lib/chapters";
import { label as psalmsLabel, nextInSet, parsePsalter, setForChoice } from "../../../lib/dailyPsalms";
import { useReduceMotion } from "../../../lib/motion";
import { barTopIn, chapterTitle, HEADER_START, headerOnScroll, scrollToClearBar, sheetTopIn, shortRef } from "../../../lib/reader";
import { EMPTY_SELECTION, formatSpan, selectionSpan, spanRef, tapVerse } from "../../../lib/selection";
import { dayOf, partOf } from "../../../lib/today";
import { useAccessibility } from "../../../state/accessibility";
import { useSettings } from "../../../state/settings";

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
    /** MM-05: the verse last read, held in the bar for two seconds on a return after a gap. */
    hold?: string;
    /** The page underneath, named on the back control (navigation.ts ReaderTarget.back). */
    back?: string;
  }>();
  const ref = chapterFromParams(params.book, params.chapter);
  const { book, chapter } = ref;
  const target = params.verse === undefined ? null : Number(params.verse);
  const fromRef = params.from === undefined ? null : parseVerseId(params.from);

  const palette = usePalette();
  const window = useWindowDimensions();
  const { gutter, ax, regular } = useLayout();
  const reduceMotion = useReduceMotion();
  const screenReader = useAccessibility((s) => s.screenReader);
  const core = useCore();
  const { user } = useAppData();
  const chosen = useSettings((s) => s.translation);
  // LT-03, US-07: "Read in the BSB" stands in for this chapter only; the reader's choice is kept
  // for when the licensed text can be read again (no-ai-understand.md, "Default translation").
  const [readBsb, setReadBsb] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setReadBsb(false), [book, chapter, chosen]);
  const translation = readBsb ? "BSB" : chosen;
  const hintSeen = useSettings((s) => s.hintSeen);
  const markHintSeen = useSettings((s) => s.markHintSeen);
  // The hint is for the first visit only; once seen it never returns, even before its first tap.
  const [showHint] = useState(!hintSeen);
  // The hint goes once it has been followed: it stayed above the text after the first verse was tapped (UX pass, 15 Oct 2026).
  const [hintFollowed, setHintFollowed] = useState(false);
  // Names this reader to the guide it opens, so a guide's Next moves this reader only (state/guide.ts).
  const readerId = useRef(`reader-${Math.random().toString(36).slice(2)}`).current;
  // This screen's own navigation: router.setParams acts on the focused route, which is the
  // guide's while a guide is open, so the follow below would move the sheet, not the text.
  const navigation = useNavigation<{ setParams: (params: Record<string, string | undefined>) => void }>();

  // Licensed translations come through Yada's proxy (or API.Bible on the dev flag), not the core
  // bundle (docs/licensed-translations.md). One the proxy stopped serving mid-session still goes
  // there and gets its "Couldn't load" line; at the next launch hydrate drops it.
  const licensedCode = licensedEnabled() && isLicensedCode(translation) ? translation : null;
  const licensed = useLicensedChapter(licensedCode, book, chapter, attempt);
  const { data: bundled, error: versesError } = useQuery(
    async () => (licensedCode === null ? getChapter(core, book, chapter, translation) : undefined),
    [book, chapter, translation, licensedCode, attempt],
  );
  const verses: VerseText[] | undefined =
    licensedCode === null
      ? // US-09: a chapter that couldn't be read draws its one sentence, not a page loading for ever.
        (bundled ?? (versesError !== undefined ? [] : undefined))
      : licensed === undefined
        ? undefined
        : licensed.status === "ok"
          ? // A bridged verse ("[1-2]") is one row numbered 1–2 and keyed by its first verse, so
            // selecting it selects verse 1 and verse 2 has no row of its own (review, 10 Oct 2026).
            licensed.verses.map((v) => ({ ord: chapterBounds(book, chapter)[0] - 1 + v.verse, verse: v.verse, through: v.through, text: v.text }))
          : [];
  // Re-read once the book's Understand file arrives: it downloads the first time the book opens.
  const understandFile = useUnderstand((s) => s.installed[book]?.file ?? "");
  const { data: passages } = useQuery(() => loadPassages(book), [book, understandFile]);
  const pericopes = passages?.map(asPericope);
  const prophet = prophetLeads(passages ?? []);
  const fullPassages = new Map((passages ?? []).map((p) => [p.startOrd, p]));
  // JR-01: the tip shows above the first psalm a reader opens, and stays for this visit once shown.
  const psalmTipSeen = useSettings((s) => s.psalmTipSeen);
  const [psalmTip] = useState(book === "PSA" && !psalmTipSeen);
  // PG-01: each passage's title above its first verse, mid-chapter too (edge case 5).
  const startsMap = new Map<number, PericopeRow>((pericopes ?? []).map((p) => [p.start_ord, p]));
  const starts = useRef(startsMap);
  starts.current = startsMap;
  // RU-6 (fresh-eyes review, approved by John 23 Oct 2026): the chapter in the BSB's own paragraphs, one list row
  // each. A passage title and a verse this version leaves out (PD-05) stand between verses, so they break one too.
  const paragraphs =
    verses === undefined
      ? undefined
      : groupParagraphs(verses, (v, before) => isParagraphStart(v.ord) || startsMap.has(v.ord) || (before !== undefined && (before.through ?? before.verse) + 1 < v.verse));
  const paragraphsRef = useRef<VerseText[][]>([]);
  paragraphsRef.current = paragraphs ?? [];
  // DP-04: a chapter that opens inside a passage (John 16 in 15:18–16:4) still names it, quietly,
  // in small capitals; a title button there would claim the passage starts here.
  const holding = pericopes === undefined ? null : pericopeForVerse(pericopes, chapterBounds(book, chapter)[0]);
  const opener = holding !== null && !startsMap.has(chapterBounds(book, chapter)[0]) ? holding.label : null;
  const { data: understood } = useQuery(() => loadChapterUnderstand(book, ...chapterBounds(book, chapter)), [book, chapter, understandFile]);
  const entryOrds = understood?.ords;
  // Study notes come down on their own the first time a book opens while online (canvas SN
  // brief 4), and a verse with a note offers Understand like one with an entry (brief 5), so a
  // See also target such as John 3:19–20 always has something to open.
  const studyFile = useStudy((s) => s.installed[book]?.file ?? "");
  useEffect(() => {
    void ensureStudy(user, book);
    void ensureUnderstand(user, book);
  }, [user, book]);
  // People match against the BSB text whatever the reader is reading, as Understand matches them.
  const { data: studyOrds } = useQuery(
    async () => loadStudyOrds(book, ...chapterBounds(book, chapter), await getChapter(core, book, chapter, "BSB")),
    [book, chapter, studyFile],
  );
  // MM-08: the End page's "Begun 3 Sep" is the first time this book was opened here.
  useEffect(() => {
    void markBookBegun(user, book);
  }, [user, book]);
  // SW-03: past a book's last chapter the swipe stops on the End page.
  const [atEnd, setAtEnd] = useState(false);
  const [welcome, setWelcome] = useState<{ book: BookCode; intro: BookIntro } | null>(null);
  useEffect(() => {
    setAtEnd(false);
    setWelcome(null);
  }, [book, chapter]);
  // MM-01: a passage is finished when the reader reaches the boundary after its last verse, the next
  // passage's title. That one moment feeds Home, plans and progress (review §2.1). Refs, because
  // FlatList keeps the first onViewableItemsChanged it was given.
  const passagesRef = useRef<PericopeRow[]>([]);
  passagesRef.current = pericopes ?? [];
  const finished = useRef(new Set<string>());
  // Only a boundary the reader scrolled to counts (review, 12 Oct 2026): opening John 2, or landing on
  // a verse from Search, puts a passage start on screen without anyone having read up to it.
  const readerScrolled = useRef(false);
  useEffect(() => {
    readerScrolled.current = false;
  }, [book, chapter]);
  const finishBefore = useCallback(
    (ord: number) => {
      if (!readerScrolled.current) return;
      const list = passagesRef.current;
      const index = list.findIndex((p) => p.start_ord === ord);
      const done = index > 0 ? list[index - 1] : undefined;
      if (done === undefined || finished.current.has(done.pericope_id)) return;
      finished.current.add(done.pericope_id);
      const thread = bookThread(book);
      // NP-01: the first passage read is when a daily reminder means something; Yada asks then, once.
      void countDay(user).catch(() => undefined);
      void markPassageRead(user, thread, readThread(done.pericope_id, thread), stepAfter(index - 1))
        .then(() => shouldAsk(user, "passage-end"))
        .then((ask) => {
          if (ask) router.push("/remind-ask");
        });
    },
    [user, book],
  );
  const finishRef = useRef(finishBefore);
  finishRef.current = finishBefore;

  // RP-04: on M'Cheyne, reaching the end of a chapter in the plan's reading finishes that portion, and
  // the next portion leads above the chapter links ("Next reading · Matthew 2"; TD-22). Only when the reader
  // scrolled to the end, as MM-01 counts a passage (review, 12 Oct 2026).
  const [plan, setPlan] = useState<{ state: McheyneState; justRead: boolean } | null>(null);
  const loadPlan = useCallback(
    async (justRead = false) => {
      if ((await loadYourPlan(user)) !== "mcheyne") return setPlan(null);
      setPlan({ state: await loadMcheyne(user), justRead });
    },
    [user],
  );
  useEffect(() => {
    void loadPlan();
  }, [book, chapter, loadPlan]);
  // A portion is finished when its own last verse is on screen: the range's end (Psalm 119:24) or the
  // chapter's last, in the chapter where the portion ends ("Genesis 9, 10" ends in 10). The reader must
  // have scrolled to it, unless it all fits on the screen at once (Psalm 117) (review, 13 Oct 2026).
  const markPlan = useRef<(visible: ReadonlySet<number>) => void>(() => undefined);
  markPlan.current = (visible) => {
    if (plan === null || verses === undefined || verses.length === 0) return;
    const n = nextPortion(plan.state);
    const reading = n === null ? undefined : MCHEYNE_READINGS[n.reading];
    if (n === null || reading === undefined) return;
    const chapterLast = verses[verses.length - 1]?.verse ?? 0;
    const due = reading.flatMap((portion, pi) => {
      const last = portion[portion.length - 1];
      if (last === undefined || last.b !== book || last.c !== chapter || plan.state.read.has(keyOf(n.reading, pi))) return [];
      const end = last.ve ?? chapterLast;
      const start = portion.length === 1 ? (last.vs ?? 1) : 1;
      return visible.has(end) && (readerScrolled.current || visible.has(start)) ? [pi] : [];
    });
    if (due.length === 0) return;
    setPlan({ state: { ...plan.state, read: new Set([...plan.state.read, ...due.map((pi) => keyOf(n.reading, pi))]) }, justRead: true });
    void Promise.all(due.map((pi) => markPortionRead(user, plan.state.round, n.reading, pi))).then(() => loadPlan(true));
  };
  // The streak (lib/rhythm.ts): a chapter's last verse reached by scrolling counts the day, or the whole
  // chapter on screen at once (Psalm 117), as RP-04 counts a portion.
  // The chapter already counted on this screen: onScrollEndDrag calls markDay on every drag end while the last
  // verse is visible, and without this each nudge ran countDay again. Keyed by chapter, so a new one counts afresh.
  const dayCounted = useRef<string | null>(null);
  const markDay = useRef<(visible: ReadonlySet<number>) => void>(() => undefined);
  markDay.current = (visible) => {
    const last = verses?.[verses.length - 1]?.verse;
    if (last === undefined || !visible.has(last)) return;
    if (readerScrolled.current || visible.has(verses?.[0]?.verse ?? 1)) {
      const key = chapterKey(book, chapter);
      if (dayCounted.current === key) return;
      dayCounted.current = key;
      void countDay(user).catch(() => undefined);
      // RT-03, RT-04: the same moment counts the chapter, once, in any translation (build 10a).
      if (readKeys.has(key)) return;
      // Read back rather than added locally: the first load of the set can land after this write and undo a local add.
      void markChapterRead(user, key)
        .then(() => loadChaptersRead(user))
        .then(setReadKeys)
        .catch((error: unknown) => {
          // The chapter stays unticked and reading goes on; a failed local write is a bug, so say so in development.
          if (__DEV__) console.warn("marking the chapter read failed", key, error);
        });
    }
  };
  // Chapters read in this book, for the calm close's bar (RT-03) and the end of the book (RT-04).
  const [readKeys, setReadKeys] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let live = true;
    loadChaptersRead(user).then(
      (keys) => live && setReadKeys(keys),
      (error: unknown) => {
        // The close's bar shows no chapters read; a failed local read is a bug, so say so in development.
        if (__DEV__) console.warn("chapters read failed to load", error);
      },
    );
    return () => {
      live = false;
    };
  }, [user, book, chapter]);
  // The plan arrives after the first verses are counted: a short chapter already on screen is checked then.
  useEffect(() => {
    if (plan !== null) markPlan.current(visibleVerses.current);
  }, [plan]);
  const planNext = (() => {
    if (plan === null) return null;
    const n = nextPortion(plan.state);
    const reading = n === null ? undefined : MCHEYNE_READINGS[n.reading];
    const portion = n === null ? undefined : reading?.[n.portion];
    if (n === null || reading === undefined || portion === undefined) return null;
    // Never this chapter itself: the row points on, to the plan's next portion elsewhere.
    if (portion.some((seg) => seg.b === book && seg.c === chapter)) return null;
    const here = portionsInChapter(reading, book, chapter).length > 0;
    return here || plan.justRead ? portion : null;
  })();
  // DR-02, DR-03: on one of today's psalms, the next in the set leads above the chapter links, as M'Cheyne's
  // does; after the morning's last, the evening's set is named and can be opened early. No "done".
  const [psalmsNext, setPsalmsNext] = useState<{ overline: string; title: string; to: ChapterRef } | null>(null);
  useEffect(() => {
    setPsalmsNext(null);
    if (book !== "PSA") return;
    let live = true;
    void loadSettings(user).then((stored) => {
      const choice = parsePsalter(stored["dailyPsalms"]);
      const now = new Date();
      const part = partOf(now);
      const set = setForChoice(dayOf(now), part, choice);
      if (!live || choice !== "1662" || set === null || !set.some((r) => r.psalm === chapter)) return;
      const n = nextInSet(set, chapter);
      if (n !== null) return setPsalmsNext({ overline: `Next this ${part}`, title: `Psalm ${n.psalm}`, to: { book: "PSA", chapter: n.psalm } });
      const evening = part === "morning" ? setForChoice(dayOf(now), "evening", choice) : null;
      const first = evening?.[0];
      if (evening !== null && first !== undefined) setPsalmsNext({ overline: "This evening", title: psalmsLabel(evening), to: { book: "PSA", chapter: first.psalm } });
    });
    return () => {
      live = false;
    };
  }, [user, book, chapter]);
  // RT-03 closes open reading. Today's psalms and an M'Cheyne portion lead with their own Next (DR-02, RP-04) and keep it.
  const closeCard = psalmsNext === null && planNext === null;
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [headerHeight, setHeaderHeight] = useState(110);
  const [barHeight, setBarHeight] = useState(0);
  // SC-01: the About handle waits at the bottom of chapter 1 until reading starts.
  const [nearTop, setNearTop] = useState(true);
  const intro = useBookIntro(book);
  const insets = useSafeAreaInsets();
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
  // MM-09: a drag while the voice reads lets go of the text; following resumes only when the narration
  // reaches what is on screen, with one light tick and "Following again" in the mini player.
  const detached = useRef(false);
  const visibleVerses = useRef(new Set<number>());
  const [followingAgain, setFollowingAgain] = useState(false);

  const listRef = useRef<FlatList<VerseText[]>>(null);
  // Paragraph rows by their first verse, and each verse's place inside its paragraph (RU-6).
  const rows = useRef(new Map<number, View>());
  const rects = useRef({ for: "", byVerse: new Map<number, VerseRect>() });
  // Places are kept for the chapter and text on screen only: verse 5 of the last chapter is not verse 5 of this one.
  const placesKey = useRef("");
  placesKey.current = `${book}.${chapter}.${translation}`;
  const rectOf = useCallback((verse: number) => (rects.current.for === placesKey.current ? rects.current.byVerse.get(verse) : undefined), []);
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

  // MM-05: back after a gap, the verse last read holds the bar for two seconds, then lets go; the
  // reader lands one verse above it. VoiceOver hears where they stopped instead.
  useEffect(() => {
    const held = params.hold === undefined ? null : Number(params.hold);
    if (held === null || !Number.isInteger(held)) return;
    if (screenReader) {
      AccessibilityInfo.announceForAccessibility(`Where you stopped, ${chapterTitle(book, chapter)}:${held}`);
      return;
    }
    setSelection({ anchor: held, end: null });
    const timer = setTimeout(() => setSelection((s) => (s.anchor === held && s.end === null ? EMPTY_SELECTION : s)), 2000);
    return () => clearTimeout(timer);
  }, [book, chapter, params.hold, screenReader]);

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
  const placement = useRef({ resume, headerHeight, ax, height: window.height });
  placement.current = { resume, headerHeight, ax, height: window.height };
  // RU-6: a verse sits inside its paragraph, so a jump measures where the verse's lines are and scrolls by that. A
  // paragraph not yet drawn has no lines to measure: the list is moved to it by index, then asked again once it has
  // been laid out (a few tries, 120 ms apart, as rows render; never a timer that runs on).
  const land = useCallback((verse: number, playing: boolean, animated: boolean, tries = 0) => {
    const p = placement.current;
    const list = paragraphsRef.current;
    const index = list.findIndex((g) => verse >= (g[0]?.verse ?? 0) && verse <= lastVerseOf(g));
    const paragraph = list[index]?.[0]?.verse;
    if (paragraph === undefined) return;
    // Resumed, the verse sits just below the header; any other jump a fifth of the way down; the playing verse 30% down.
    const below = p.headerHeight + SPACE.sm;
    const y = playing ? (p.ax ? below : 0.3 * p.height) : p.resume || p.ax ? below : 0.2 * p.height;
    const node = rows.current.get(paragraph);
    const rect = rectOf(verse);
    if (node !== undefined && rect !== undefined) {
      node.measureInWindow((_x, top) => {
        listRef.current?.scrollToOffset({ offset: Math.max(0, offset.current + top + rect.top - y), animated });
      });
      return;
    }
    listRef.current?.scrollToIndex({ index, viewPosition: 0, viewOffset: y, animated: false });
    if (tries < 4) setTimeout(() => land(verse, playing, animated, tries + 1), 120);
  }, []);

  // Land on the requested verse once its chapter is on screen; once per arrival.
  useEffect(() => {
    if (verses === undefined) return;
    const arrival = `${book}.${chapter}.${String(target)}`;
    if (scrolledFor.current === arrival) return;
    scrolledFor.current = arrival;
    const known = target !== null && verses.some((v) => v.verse === target);
    const timer = setTimeout(() => {
      if (!known || target === null) listRef.current?.scrollToOffset({ offset: 0, animated: false });
      else land(target, false, false);
    }, 60);
    return () => clearTimeout(timer);
  }, [verses, book, chapter, target, land]);

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

  // Your space (PS-02): this chapter's highlights and notes, read again whenever they change, here, in the Note
  // sheet or from iCloud (data/user.ts subscribeYourSpace).
  const [marks, setMarks] = useState<{ highlights: ReadonlyMap<number, HighlightColor>; notes: ReadonlySet<number> }>({ highlights: new Map(), notes: new Set() });
  const loadMarks = useCallback(async () => {
    const [highlights, notes] = await Promise.all([loadHighlights(user, book, chapter), loadChapterNotes(user, book, chapter)]);
    if (location.current.book === book && location.current.chapter === chapter) setMarks({ highlights, notes: notes.verses });
  }, [user, book, chapter]);
  useEffect(() => {
    // The chapter reads on without its marks; a failed local read is a bug, so say so in development.
    const reload = () =>
      loadMarks().catch((error: unknown) => {
        if (__DEV__) console.warn("highlights and notes failed to load", error);
      });
    void reload();
    return subscribeYourSpace(() => void reload());
  }, [loadMarks]);

  // Reading position: the first verse whose middle is below the header, saved as it settles.
  // FlatList counts a verse under the floating header as visible, so a passage's title row
  // scrolled to the top still reported the passage before it (simulator, 11 Oct 2026): the bar
  // at rest offered 1:1–18 above 1:19, and Home's Continue pointed into a finished passage.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useRef({ book, chapter });
  location.current = { book, chapter };
  const headerBottom = useRef(headerHeight);
  headerBottom.current = headerHeight;
  const windowHeight = useRef(window.height);
  windowHeight.current = window.height;
  // RU-6: the list's rows are paragraphs, so which verses are on screen comes from each verse's lines, measured.
  const visibleParagraphs = useRef<{ index: number; verses: readonly VerseText[] }[]>([]);
  const measureVisible = useCallback(async () => {
    const out: { item: VerseText; index: number; first: boolean; top: number; bottom: number }[] = [];
    for (const { index, verses: group } of visibleParagraphs.current) {
      const node = rows.current.get(group[0]?.verse ?? -1);
      if (node === undefined) continue;
      const box = await new Promise<{ y: number; h: number }>((resolve) => node.measureInWindow((_x, y, _w, h) => resolve({ y, h })));
      group.forEach((item, i) => {
        // A paragraph whose lines aren't laid out yet counts each of its verses as the whole paragraph.
        const rect = rectOf(item.verse) ?? { top: 0, bottom: box.h };
        out.push({ item, index, first: i === 0, top: box.y + rect.top, bottom: box.y + rect.bottom });
      });
    }
    return out;
  }, []);
  // The chapter changed while the rows were measured: they are the old chapter's, and would save its verse number
  // under the new one (gate review, 11 Oct 2026).
  const stale = (items: readonly { item: VerseText }[]) =>
    items.some(({ item }) => {
      const at = ordToParts(item.ord);
      return at.book !== location.current.book || at.chapter !== location.current.chapter;
    });
  const refreshVisible = useRef<() => void>(() => undefined);
  refreshVisible.current = () => {
    void measureVisible().then((seen) => {
      const onScreen = seen.filter((s) => {
        const mid = (s.top + s.bottom) / 2;
        return mid >= 0 && mid <= windowHeight.current;
      });
      if (stale(onScreen)) return;
      visibleVerses.current = new Set(onScreen.map((s) => s.item.verse));
      markPlan.current(visibleVerses.current);
      markDay.current(visibleVerses.current);
      if (onScreen.length === 0) return;
      // MM-01: the boundary is drawn only mid-chapter (list index above 0), and only that one counts. A passage title
      // always opens a paragraph, so it is that paragraph's first verse.
      for (const s of onScreen) {
        if (s.first && s.index > 0 && starts.current.has(s.item.ord)) finishRef.current(s.item.ord);
      }
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void measureVisible().then((settled) => {
          const top = settled.find((s) => (s.top + s.bottom) / 2 > headerBottom.current) ?? settled[0];
          if (top === undefined || stale([top])) return;
          setTopVerse(top.item.ord);
          void savePosition(user, `${location.current.book}.${location.current.chapter}.${top.item.verse}`);
        });
      }, 400);
    });
  };
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<VerseText[]>[] }) => {
    visibleParagraphs.current = viewableItems.filter((t) => t.isViewable).map((t) => ({ index: t.index ?? 0, verses: t.item }));
    refreshVisible.current();
  }).current;

  /** A verse's top and bottom in the window: its paragraph measured, plus the verse's place in it. */
  const verseWindow = useCallback(
    (verse: number) =>
      new Promise<VerseRect | null>((resolve) => {
        const group = paragraphsRef.current.find((g) => verse >= (g[0]?.verse ?? 0) && verse <= lastVerseOf(g));
        const node = group?.[0] === undefined ? undefined : rows.current.get(group[0].verse);
        if (node === undefined) return resolve(null);
        node.measureInWindow((_x, y, _w, h) => {
          const r = rectOf(verse) ?? { top: 0, bottom: h };
          resolve({ top: y + r.top, bottom: y + r.bottom });
        });
      }),
    [],
  );

  const span = selectionSpan(selection);
  const ordOf = (verse: number) => chapterBounds(book, chapter)[0] - 1 + verse;
  // A range offers Understand when any verse in it has an entry (passage Understand, J01-12).
  const hasEntry =
    span !== null &&
    Array.from({ length: span.end - span.start + 1 }, (_, i) => span.start + i).some(
      (v) => entryOrds?.has(ordOf(v)) === true || studyOrds?.has(ordOf(v)) === true,
    );

  const { data: selectionLetters } = useQuery(
    async () => (span === null || scriptOf(book) === "greek" ? [] : getLanguageLetters(core, ordOf(span.start), ordOf(span.end))),
    [book, chapter, span?.start, span?.end],
  );

  /** Scroll so the selection sits between the header and `barTop` (window y). */
  const scrollSelectionAbove = useCallback(
    (barTop: number) => {
      if (span === null) return;
      void Promise.all([verseWindow(span.start), verseWindow(span.end)]).then(([first, last]) => {
        if (first === null || last === null) return;
        const delta = scrollToClearBar({ top: first.top, bottom: last.bottom }, { headerBottom: headerHeight, barTop });
        if (Math.abs(delta) > 1) {
          listRef.current?.scrollToOffset({ offset: Math.max(0, offset.current + delta), animated: !reduceMotion });
        }
      });
    },
    [span?.start, span?.end, headerHeight, reduceMotion, verseWindow],
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
    if (!focused.current || span !== null) return;
    if (detached.current) {
      if (!visibleVerses.current.has(playingVerse)) return;
      detached.current = false;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setFollowingAgain(true);
      if (screenReader) AccessibilityInfo.announceForAccessibility("Following again");
      return;
    }
    // At AX sizes a verse can outgrow the screen; its first line goes under the header instead (land()).
    if (verses.some((v) => v.verse === playingVerse)) land(playingVerse, true, !reduceMotion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingHere, playingVerse]);
  useEffect(() => {
    if (!followingAgain) return;
    const timer = setTimeout(() => setFollowingAgain(false), 2000);
    return () => clearTimeout(timer);
  }, [followingAgain]);

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
    // `from` and `back` stay: turning the page leaves the same screen underneath, so the back control still names
    // it (IA stress test, 15 Oct 2026: after a swipe the chip said "Home" and went back to John 1).
    router.setParams({ book: next.book, chapter: String(next.chapter), verse: undefined, select: undefined, resume: undefined });
  }, []);

  const label = span === null ? "" : formatSpan(BOOK_CODES[book].name, chapter, span);
  const sheetRef = span === null ? "" : spanRef(book, chapter, span);
  const verseLabel = span === null ? "" : span.start === span.end ? `${chapter}:${span.start}` : `${chapter}:${span.start}–${span.end}`;
  const ids = span === null ? [] : Array.from({ length: span.end - span.start + 1 }, (_, i) => formatVerseId(book, chapter, span.start + i));
  const allMarked = ids.length > 0 && ids.every((id) => bookmarks.has(id));
  // The colour the whole selection already wears, so the bar can ring it (PS-01).
  const firstColor = span === null ? undefined : marks.highlights.get(span.start);
  const selectionColor =
    span !== null && firstColor !== undefined && ids.every((_, i) => marks.highlights.get(span.start + i) === firstColor) ? firstColor : null;
  const imageable = !isLicensedCode(translation);

  const openNote = (verse: number) => router.push({ pathname: "/note", params: { book, chapter: String(chapter), verse: String(verse) } });
  // RU-8: the Readers differ mark opens that verse's Understand, landed on its Readers differ.
  const openDiffers = (verse: number) =>
    router.push({ pathname: "/understand", params: { ref: spanRef(book, chapter, { start: verse, end: verse }), section: "differ", reader: readerId } });

  const highlightSelection = async (color: HighlightColor | null) => {
    try {
      await setHighlight(user, ids, color);
    } catch (error: unknown) {
      // Called with void from the bar, so a failed write was an unhandled rejection and VoiceOver heard nothing.
      if (__DEV__) console.warn("highlight failed", error);
      AccessibilityInfo.announceForAccessibility("Couldn’t highlight");
      return;
    }
    void Haptics.selectionAsync();
    AccessibilityInfo.announceForAccessibility(color === null ? "Highlight removed" : `Highlighted ${color}`);
  };

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
  const open = (section?: "original") => {
    clearForSheet();
    // `reader`: a range opens its guide here, and the guide's Next moves this reader (ON-04).
    router.push({ pathname: "/understand", params: section === undefined ? { ref: sheetRef, reader: readerId } : { ref: sheetRef, section, reader: readerId } });
  };

  async function act(action: string): Promise<void> {
    // Menu items and VoiceOver actions both arrive by lowercase id.
    // LT-04, LT-05: a licensed version's words travel with the rights holder's notice, verbatim (§7).
    const notice = licensed?.status === "ok" ? `\n${licensed.copyright}` : "";
    // "John 1:1, NKJV" (LT-04); The Message by its name, which its notice uses (LT-05).
    const quote = `${selectedText()}\n— ${label}, ${translation === "MSG" ? "The Message" : translation}${notice}`;
    if (action === "copy") {
      await Clipboard.setStringAsync(quote);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Review §3 E1: confirmed by a haptic only, VoiceOver heard nothing.
      AccessibilityInfo.announceForAccessibility("Copied");
    } else if (action === "share") {
      void Share.share({ message: quote });
    } else if (action === "share as an image") {
      if (span === null) return;
      router.push({ pathname: "/share-image", params: { verse: formatVerseId(book, chapter, span.start), through: String(span.end), translation } });
    } else if (action === "note") {
      if (span !== null) openNote(span.start);
    } else if (action === "original") {
      open("original");
    } else if (action === "compare") {
      // CP-01: the bar's Compare opens Compare itself, not Understand at a section.
      clearForSheet();
      router.push({ pathname: "/evidence/translations", params: { ref: sheetRef } });
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
      AccessibilityInfo.announceForAccessibility(allMarked ? "Removed" : "Bookmarked");
    }
  }

  const tap = (verse: number) => {
    setSelection((s) => tapVerse(s, verse));
    void Haptics.selectionAsync();
    if (!hintSeen) markHintSeen();
    setHintFollowed(true);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    offset.current = y;
    setNearTop(y < 160);
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
  // The chapter's progress and the playing verse's words: the mini player's line and the strip that keeps a
  // playing reading in view above a selection's actions (John, 15 Oct 2026).
  const audioProgress =
    session === null || session.verses.length === 0
      ? null
      : {
          segments: progressSegments(
            pericopesOf(session.book),
            (session.verses[0]?.ord ?? 0) - (session.verses[0]?.verse ?? 1) + 1,
            session.verses[session.verses.length - 1]?.verse ?? session.verses.length,
          ),
          verse: playingVerse ?? 1,
        };
  const playingLine = session === null ? "" : `${playingVerse ?? 1}  ${spokenText(currentVerse(session)?.text ?? "", session.translation)}`;
  // EG-03: on a licensed page Listen reads the BSB (John, 12 Oct 2026); the licensed text is never spoken.
  const canListen = voice !== null && audioTranslation(translation) !== null && verses !== undefined && verses.length > 0;

  const readerHeader = (
      <ReaderHeader
        title={title}
        translation={translation}
        back={fromRef !== null ? { label: shortRef(fromRef), accessibility: formatDisplayRef(fromRef) } : params.back !== undefined ? { label: params.back, accessibility: params.back } : null}
        collapsed={header.collapsed}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        onContents={() => router.push({ pathname: "/contents", params: { book, chapter: String(chapter) } })}
        onType={() => router.push("/type-settings")}
        onExpand={() => setHeader((h) => ({ ...h, collapsed: false }))}
        onHeight={setHeaderHeight}
      />
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }} onMagicTap={session === null ? undefined : togglePlay}>
      <ChapterSwipe
        // SW-04: off while a verse is selected, and under VoiceOver, which turns pages by the links.
        enabled={span === null && !screenReader && !atEnd}
        reduceMotion={reduceMotion}
        // Back from the End page the chapter must come home too, not stay where the swipe left it.
        chapterKey={`${book}.${chapter}${atEnd ? ".end" : ""}`}
        previous={chapter > 1 ? <ChapterPeek book={book} chapter={chapter - 1} translation={translation} top={headerHeight + SPACE.sm} /> : null}
        next={
          chapter < BOOK_CODES[book].chapters ? (
            <ChapterPeek book={book} chapter={chapter + 1} translation={translation} top={headerHeight + SPACE.sm} />
          ) : (
            <EndOfBook book={book} onNext={() => undefined} />
          )
        }
        onPrevious={() => goTo({ book, chapter: chapter - 1 })}
        onNext={() => (chapter < BOOK_CODES[book].chapters ? goTo({ book, chapter: chapter + 1 }) : setAtEnd(true))}
      >
      {paragraphs === undefined ? null : (
        <FlatList
          ref={listRef}
          data={paragraphs}
          keyExtractor={(group) => String(group[0]?.ord)}
          contentContainerStyle={[
            {
              paddingTop: headerHeight + SPACE.sm,
              paddingHorizontal: gutter,
              paddingBottom: Math.max(barHeight, SPACE.xxl) + SPACE.lg,
            },
            // TB-02, DU-02: on an iPad or an open Duo the text keeps its measure, centred; the list still scrolls
            // from anywhere across the window.
            regular ? { width: "100%", maxWidth: WIDE.measure + 2 * gutter, alignSelf: "center" } : null,
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={40}
          windowSize={15}
          onViewableItemsChanged={onViewableItemsChanged}
          // RU-6: a paragraph can be taller than the screen, so any part of one on screen counts; the verses in it are
          // then measured (refreshVisible).
          viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}
          onScroll={onScroll}
          onScrollBeginDrag={() => {
            readerScrolled.current = true;
            dragging.current = true;
            draggedAt.current = Date.now();
            if (playingHere) detached.current = true;
          }}
          onMomentumScrollEnd={() => {
            dragging.current = false;
            // Inside one long paragraph the visible rows never change, so the viewability callback never runs.
            refreshVisible.current();
          }}
          onScrollEndDrag={(e) => {
            if (e.nativeEvent.velocity === undefined || Math.abs(e.nativeEvent.velocity.y) < 0.01) dragging.current = false;
            // Landed on a chapter's last verse (a link, Continue) and nudged: the visible verses never changed, so the
            // viewability callback never ran and the chapter went uncounted (simulator, Jude 1, 18 Oct 2026).
            refreshVisible.current();
          }}
          scrollEventThrottle={16}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Rows are variable height, so a far-off paragraph is not yet measured. A pixel estimate lands on the
            // wrong verse (0A: verse 7 instead of 34); get close and let rows render: land() asks again.
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
          }}
          ListEmptyComponent={
            licensedCode === null && versesError !== undefined ? (
              <Unavailable
                line={`${chapterTitle(book, chapter)} couldn’t be opened.`}
                actions={[
                  { label: "Try again", onPress: () => setAttempt((n) => n + 1), testID: "chapter-retry" },
                  { label: "Back to Bible", onPress: () => router.dismissTo("/"), testID: "chapter-home" },
                ]}
              />
            ) : licensed !== undefined && licensed.status !== "ok" ? (
              <LicensedUnavailable
                line={`${chapterTitle(book, chapter)} in the ${licensed.translation} ${
                  licensed.status === "needs-connection" ? "needs a connection" : licensed.status === "error" && licensed.reason === "budget" ? "isn’t available until next month" : "didn’t load"
                }.`}
                // Out of the month's API.Bible calls, trying again cannot help (licensed.ts "budget").
                onRetry={licensed.status === "needs-connection" || (licensed.status === "error" && licensed.reason === "budget") ? null : () => setAttempt((n) => n + 1)}
                onBsb={() => setReadBsb(true)}
              />
            ) : null
          }
          ListHeaderComponent={
            <>
              {psalmTip && !psalmTipSeen ? <PsalmTip /> : null}
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
          renderItem={({ item: group, index }) => {
            const item = group[0];
            if (item === undefined) return null;
            const start = startsMap.get(item.ord);
            const full = start === undefined ? undefined : fullPassages.get(start.start_ord);
            const lead = start === undefined ? undefined : prophet.get(start.pericope_id);
            // The psalm's lines skip what its title and superscription already say (verse 1 carries it).
            const psalmLines = full === undefined || full.mode !== "psalms" ? [] : readerLeadLines(full, [full.label, item.text]);
            const previous = index === 0 ? undefined : paragraphs[index - 1];
            const before = previous?.[previous.length - 1];
            const last = lastVerseOf(group);
            return (
            <>
            {/* PD-05: a verse this version leaves out (John 5:4) keeps its place as one line. */}
            {before !== undefined ? <MissingVerseLines book={book} chapter={chapter} after={before.through ?? before.verse} before={item.verse} /> : null}
            {lead !== undefined ? <ProphetLeadLines lead={lead} /> : null}
            {start !== undefined ? (
              <PassageTitle pericope={start} book={BOOK_CODES[book].name} boundary={index > 0} onPress={() => openGuide(start.pericope_id)} />
            ) : null}
            {full !== undefined && full.mode === "psalms" ? (
              <PsalmLeadLines lines={psalmLines} passageId={full.id} about={full.psalm_about.length > 0} />
            ) : null}
            {index === 0 && showHint && !hintFollowed ? (
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
              <Paragraph
                book={book}
                chapter={chapter}
                translation={translation}
                verses={group.map((v) => ({
                  verse: v.verse,
                  through: v.through ?? v.verse,
                  text: v.text,
                  selected: span !== null && v.verse >= span.start && v.verse <= span.end,
                  bookmarked: bookmarks.has(`${book}.${chapter}.${v.verse}`),
                  hasEntry: entryOrds?.has(v.ord) ?? false,
                  differs: understood?.differs.has(v.ord) ?? false,
                  highlight: marks.highlights.get(v.verse) ?? null,
                  noted: marks.notes.has(v.verse),
                }))}
                selectionContinues={span !== null && span.start <= last && span.end > last}
                onPress={tap}
                onNote={openNote}
                onDiffers={openDiffers}
                onAction={(verse, action) => {
                  if (action === "note") return openNote(verse);
                  setSelection({ anchor: verse, end: null });
                  void act(action);
                }}
                onRects={(laid) => {
                  if (rects.current.for !== placesKey.current) rects.current = { for: placesKey.current, byVerse: new Map() };
                  for (const [verse, rect] of laid) rects.current.byVerse.set(verse, rect);
                }}
              />
            </View>
            </>
            );
          }}
          ListFooterComponent={
            <View style={styles.footer}>
              {psalmsNext !== null ? (
                <ListRow
                  first
                  overline={psalmsNext.overline}
                  title={psalmsNext.title}
                  label={`${psalmsNext.overline}, ${psalmsNext.title}`}
                  onPress={() => goTo(psalmsNext.to)}
                  testID="reader-psalms-next"
                />
              ) : null}
              {planNext !== null && planNext[0] !== undefined ? (
                <ListRow
                  first={psalmsNext === null}
                  overline="Next reading"
                  title={portionLabel(planNext)}
                  label={`Next reading in The whole Bible, ${portionSpoken(planNext)}`}
                  onPress={() => {
                    const first = planNext[0];
                    if (first !== undefined) goTo({ book: first.b, chapter: first.c });
                  }}
                  testID="reader-plan-next"
                />
              ) : null}
              {closeCard ? (
                <ChapterClose
                  book={book}
                  chapter={chapter}
                  readKeys={readKeys}
                  onNext={(to) => goTo(to)}
                  onEnd={() => setAtEnd(true)}
                />
              ) : null}
              <View style={styles.links}>
                {prev !== null && (!closeCard || screenReader) ? (
                  <ChapterLink direction="prev" title={chapterTitle(prev.book, prev.chapter)} onPress={() => goTo(prev)} />
                ) : (
                  <View />
                )}
                {next !== null && !closeCard ? (
                  <ChapterLink direction="next" title={chapterTitle(next.book, next.chapter)} onPress={() => goTo(next)} />
                ) : null}
              </View>
              <Prose step="note" tone="muted" style={{ marginTop: 14 }}>
                {translationName}
              </Prose>
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

      {readerHeader}
      </ChapterSwipe>

      {atEnd ? (
        // SW-03: the End page stays until the reader swipes back or takes the way on.
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.paper }]} accessibilityViewIsModal>
          <ChapterSwipe enabled={!screenReader} reduceMotion={reduceMotion} chapterKey="end" previous={<View />} next={null} onPrevious={() => setAtEnd(false)} onNext={() => undefined}>
            {welcome !== null ? (
              <BookWelcome book={welcome.book} from={book} intro={welcome.intro} onStart={() => goTo({ book: welcome.book, chapter: 1 })} onBack={() => setWelcome(null)} />
            ) : (
              // SC-06: from the end of a book, the next one pauses once on its introduction, when it has an approved one.
              <EndOfBook book={book} onNext={(to) =>
                  void loadBookIntro(to)
                    .then((i) => (i === null ? goTo({ book: to, chapter: 1 }) : setWelcome({ book: to, intro: i })))
                    .catch(() => goTo({ book: to, chapter: 1 }))
                } onClose={() => setAtEnd(false)} />
            )}
          </ChapterSwipe>
        </View>
      ) : null}

      {atEnd ? null : span !== null ? (
        <ActionBar
          nowPlaying={
            session !== null && session.status !== "finished" ? (
              <NowPlayingStrip
                progress={audioProgress}
                line={session.book === book && session.chapter === chapter ? playingLine : `${chapterTitle(session.book, session.chapter)} · ${playingLine}`}
                accessibility={`Playing ${formatDisplayRef({ book: session.book, chapter: session.chapter, verse: playingVerse ?? 1 })}, ${sessionName}. Opens the player`}
                playing={session.status === "playing"}
                onOpen={() => router.push("/player")}
                onToggle={togglePlay}
              />
            ) : null
          }
          verseLabel={verseLabel}
          hasEntry={hasEntry}
          bookmarked={allMarked}
          script={scriptOf(book)}
          language={originalLanguage(scriptOf(book), selectionLetters ?? [])}
          onUnderstand={() => open()}
          onOriginal={() => open("original")}
          onCompare={() => void act("compare")}
          onMenu={(action) => void act(action)}
          highlight={selectionColor}
          imageable={imageable}
          onHighlight={(color) => void highlightSelection(color)}
          onNote={() => void act("note")}
          onCopy={() => void act("copy")}
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
      ) : session !== null && (session.status !== "finished" || (session.book === book && session.chapter === chapter)) ? (
        // US-03: a paused session stays in reach wherever the reader is ("John 2 · Verse 1"); US-04: the
        // end of a book says so and Next is off.
        <MiniPlayer
          title={pericopeForVerse(pericopesOf(session.book), ordOfVerse(session))?.label ?? chapterTitle(session.book, session.chapter)}
          detail={
            session.status === "finished"
              ? `End of ${BOOK_CODES[session.book].name}`
              : session.book === book && session.chapter === chapter
                ? followingAgain
                  ? "Following again"
                  : // The playing verse's own words after its number, as a mini player shows what is playing
                    // (John, 15 Oct 2026); one line, cut at its end.
                    playingLine
                : `${chapterTitle(session.book, session.chapter)} · Verse ${playingVerse ?? 1}`
          }
          progress={audioProgress}
          nextDisabled={session.status === "finished"}
          buffering={session.buffering === true}
          under={
            // EG-03: the page is a licensed version and the voice reads the BSB.
            session.translation !== translation && isLicensedCode(translation)
              ? { line: "Audio is the BSB", action: "Read along in the BSB", onAction: () => setReadBsb(true) }
              : null
          }
          accessibility={`${pericopeForVerse(pericopesOf(session.book), ordOfVerse(session))?.label ?? chapterTitle(session.book, session.chapter)}, ${formatDisplayRef({ book: session.book, chapter: session.chapter, verse: playingVerse ?? 1 })}, ${sessionName}. Opens the player`}
          playing={session.status === "playing"}
          onOpen={() => router.push("/player")}
          onPrevious={previousVerse}
          onToggle={togglePlay}
          onNext={nextVerse}
          onClose={endSession}
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
      {chapter === 1 && intro !== null && nearTop && !atEnd && span === null && session === null ? (
        <AboutHandle key={book} book={book} bottom={(restPassage !== null || canListen) && !header.collapsed ? barHeight : insets.bottom} />
      ) : null}
    </View>
  );
}

/** A paragraph's last verse, counting a bridged row ("1–2") to its end. */
function lastVerseOf(group: readonly VerseText[]): number {
  const last = group[group.length - 1];
  return last === undefined ? -1 : (last.through ?? last.verse);
}

/**
 * PG-01: the passage's title above its first verse, in Literata semibold with
 * a quiet chevron; it opens the passage's guide. One element to VoiceOver,
 * read before the verse it heads.
 */
function PassageTitle({ pericope, book, boundary, onPress }: { pericope: PericopeRow; book: string; boundary: boolean; onPress: () => void }) {
  const palette = usePalette();
  const range = rangeInBook(pericope.pericope_id);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // MM-01's VoiceOver form: the boundary is heard as the next passage beginning.
      accessibilityLabel={`${boundary ? "Next passage, " : ""}${pericope.label}, ${book} ${range.replace("–", " to ")}. Opens the passage guide`}
      testID={`passage-title-${pericope.pericope_id}`}
      style={({ pressed }) => [
        // MM-01: a hairline across the page after a passage's last verse, then the next one's title.
        // John (12 Oct 2026): "Next" beside the title read poorly; it is its own quiet line above it.
        boundary ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.divider, paddingTop: 18, marginTop: 10 } : null,
        pressed ? { opacity: 0.6 } : null,
      ]}
    >
      {boundary ? (
        <Chrome step="label" tone="muted" style={{ marginBottom: 2 }}>
          Next passage
        </Chrome>
      ) : null}
      <View style={styles.passageTitle}>
        <Chrome tone="ink" style={styles.passageTitleText} maxFontSizeMultiplier={1.8}>
          {pericope.label}
        </Chrome>
        <Icon name="forward" size={16} tone="muted" />
      </View>
    </Pressable>
  );
}

/**
 * LT-03, US-07, EG-04: a licensed chapter that can't be shown says so in one sentence where the text
 * would be, with the way on: the BSB for this chapter, and Try again after a failure. The reason
 * comes first now; it used to sit in the footer after the chapter links (review §3 B3).
 */
function LicensedUnavailable({ line, onRetry, onBsb }: { line: string; onRetry: (() => void) | null; onBsb: () => void }) {
  return (
    <Unavailable
      line={line}
      testID="licensed-unavailable"
      actions={[
        ...(onRetry !== null ? [{ label: "Try again", onPress: onRetry, testID: "licensed-retry" }] : []),
        { label: "Read in the BSB", onPress: onBsb, testID: "licensed-read-bsb" },
      ]}
    />
  );
}

/** One sentence where the chapter would be, and the ways on (US-07, US-09). */
function Unavailable({ line, actions, testID = "chapter-unavailable" }: { line: string; actions: ReadonlyArray<{ label: string; onPress: () => void; testID: string }>; testID?: string }) {
  const palette = usePalette();
  const pill = (label: string, onPress: () => void, testID: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [styles.link, { paddingHorizontal: 16, backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 }]}
    >
      <Chrome tone="ink" size={15} style={{ fontWeight: "500" }}>
        {label}
      </Chrome>
    </Pressable>
  );
  return (
    <View style={{ paddingTop: SPACE.xl, rowGap: SPACE.md }} testID={testID}>
      <Prose step="explanation" accessibilityRole="text">
        {line}
      </Prose>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{actions.map((a) => pill(a.label, a.onPress, a.testID))}</View>
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
  // `.msl`: 44 pt tall, tucked a little under the verse above it.
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

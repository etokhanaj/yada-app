/**
 * Home (canvas ON-01, ON-05, ON-07, ON-06): a serif `yada`, three glass
 * icons, one lead, then the books. No onboarding screens: Home is the start
 * (John asked why we had them, 11 Oct 2026).
 *
 * One lead at a time (lib/startHere.ts homeLead):
 * - first launch: `Start here · The Gospel of John · One passage at a time,
 *   explained.`, which opens John 1:1–18's guide (Deepstash's one featured
 *   first read, https://mobbin.com/screens/ae4112fa-00aa-4415-ab8f-7d1ec5c49692);
 * - a passage in progress: `Continue · John 1:39`, the passage as the title
 *   and the verse as the excerpt (Apple Books' Continue first,
 *   https://mobbin.com/screens/38f5b90d-0d5b-467f-9e2d-7155ba17a3ea);
 * - the last passage finished: `Next · John 1:19–34`.
 * Continue and a Next row together were two calls to action for one reader
 * (UX pass, 11 Oct 2026), so there is never a Next row beside Continue in
 * John. Then `N of 46 passages read`, no streak, no dates, and `All passages
 * in John`. Books carry no chapter counts (audit); Contents shows them.
 *
 * Build 12 BI-30: the lead is one card, its kind ("Continue") over the
 * chapter in Literata, the passage, Read, and how far through the book
 * ("Chapter 2 of 21"); the testament switch; the books two to a row with
 * their chapter counts, the one you're reading marked. Saved's bookmark and
 * the ⋯ menu (Recent, Settings) moved to You (YO-30). RU-10's chapter grid
 * still opens in place, under the row holding the book.
 *
 * VoiceOver order follows the eye (ON-06): Search, the title, the lead, the
 * books.
 */

import { BOOK_CODES, BOOK_ORDER, type BookCode, ordToParts, parseVerseId, verseOrd } from "@yada/schema";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { NumberGrid } from "../../components/Contents";
import { useLaunch } from "../../components/LaunchOverlay";
import { readerHref } from "../../components/navigation";
import { GlassIcon, ListRow, PageScreen } from "../../components/Page";
import { Pill } from "../../components/Pill";
import { Segmented } from "../../components/Segmented";
import { Chrome } from "../../components/Type";
import { useAppData, useCore } from "../../data/AppData";
import { getTexts } from "../../data/queries";
import { notNow, shouldAsk, turnOff, turnOn, turnOnFromAsk, useReminder } from "../../data/reminder";
import { loadProgress } from "../../data/startHere";
import { loadPericopes } from "../../data/understand";
import { decideReturn, stampOpen } from "../../data/lapse";
import { loadPositionAt } from "../../data/user";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { pericopeForVerse, type PericopeRow } from "../../lib/pericopes";
import { chapterTitle, excerptOf } from "../../lib/reader";
import { rangeInBook, verseLabel } from "../../lib/saved";
import { backAfterGap, homeLead, type HomeLead } from "../../lib/startHere";
import { useSettings } from "../../state/settings";

interface LeadState {
  readonly lead: HomeLead;
  readonly passages: readonly PericopeRow[];
  /** Continue's place. */
  readonly place: { readonly book: BookCode; readonly chapter: number; readonly verse: number; readonly label: string } | null;
  /** The passage holding the place, in its own book, when that book has passages. */
  readonly placePassage: string | null;
  readonly excerpt: string;
  /** The excerpt is the BSB's because the reader's version is licensed or lacks the verse: the lead says so. */
  readonly excerptBsb: boolean;
  /** MM-05: back after a gap; the lead says "Where you stopped", never how long. */
  readonly away: boolean;
}

const spokenRange = (range: string) => range.replace("–", " to ");

export default function Home() {
  const core = useCore();
  const { ax } = useLayout();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const launched = useSettings((s) => s.launched);
  // Read once at mount: the effect below marks the first launch before its position loads.
  const returning = useRef(launched).current;
  const [state, setState] = useState<LeadState | null>(null);
  const paused = useReminder((s) => s.paused);
  // NP-03: after a Not now, asked once more on a return three or more days later, as one line; then never.
  const [askAgain, setAskAgain] = useState(false);
  const [openBook, setOpenBook] = useState<BookCode | null>(null);
  const [chosenTestament, setTestament] = useState<"ot" | "nt" | null>(null);
  const chooseVerse = useSettings((st) => st.chooseVerse);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void shouldAsk(user, "home").then((ask) => live && setAskAgain(ask));
      return () => {
        live = false;
      };
    }, [user]),
  );
  const reminderPrefs = useReminder((s) => s.prefs);

  // A cold launch with a saved position opens the reader there (brief §8.18, decided by John
  // 10 Oct), Home beneath it. With none, Home is the first screen: it is the start (ON-01),
  // replacing the old first launch into John 1 (decision 1, JN-01). Once per process: Home can
  // remount (Page's back falls back to `replace("/")`), and that must not throw the reader
  // forward again. A warm resume never remounts anything, so it keeps whatever was on screen.
  useEffect(() => {
    if (useLaunch.getState().routed) {
      // A door chose the place (widget, link): the open still counts as the last time Yada was in use.
      void stampOpen(user).catch(() => undefined);
      return;
    }
    useLaunch.getState().markRouted();
    if (!returning) useSettings.getState().markLaunched();
    void loadPositionAt(user).then(async (saved) => {
      const position = saved === null ? null : parseVerseId(saved.id);
      // RT-01: back after a month or more, on a plain icon open only. Decided before anything else is pushed.
      if (saved !== null && position !== null && (await decideReturn(user, true).catch(() => false))) {
        router.push({ pathname: "/return", params: { place: saved.id } });
        return;
      }
      if (position === null) void stampOpen(user).catch(() => undefined);
      if (position !== null) {
        // Someone who read before this build skips the first-visit hint.
        if (!returning) useSettings.getState().markHintSeen();
        // MM-05 on a cold launch too, the commonest return: after a gap, one verse above the place with the last
        // verse held for two seconds, as Home's "Where you stopped" lands (IA stress test, 15 Oct 2026).
        const away = backAfterGap(saved?.at ?? null, new Date());
        router.push(
          readerHref(
            away
              ? { book: position.book, chapter: position.chapter, verse: Math.max(1, position.verse - 1), resume: true, hold: position.verse }
              : { book: position.book, chapter: position.chapter, verse: position.verse, resume: true },
          ),
        );
      } else {
        // Home is the first screen, so it lifts the launch overlay (§8.17).
        useLaunch.getState().markReady();
      }
    });
  }, [returning, user]);

  // Read on every focus, never cached: a guide just closed, or progress synced from another
  // device, shows at once (edge case 8).
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const [saved, progress] = await Promise.all([loadPositionAt(user), loadProgress(user)]);
        const id = saved?.id ?? null;
        const ref = id === null ? null : parseVerseId(id);
        const ord = ref === null ? null : verseOrd(ref.book, ref.chapter, ref.verse);
        const lead = homeLead({
          passages: progress.passages,
          read: progress.read,
          lastFinished: progress.lastFinished,
          place: ref === null || ord === null ? null : { book: ref.book, ord },
        });
        let excerpt = "";
        let excerptBsb = false;
        let placePassage: string | null = null;
        if (lead.kind === "continue" && ref !== null && ord !== null) {
          const [texts, own] = await Promise.all([getTexts(core, ord), loadPericopes(ref.book)]);
          excerpt = excerptOf(texts[translation] ?? texts["BSB"] ?? "");
          excerptBsb = texts[translation] === undefined;
          placePassage = pericopeForVerse(own, ord)?.label ?? null;
        } else if (lead.kind === "next") {
          const p = progress.passages[lead.passage];
          if (p !== undefined) {
            const texts = await getTexts(core, p.start_ord);
            excerpt = excerptOf(texts[translation] ?? texts["BSB"] ?? "");
            excerptBsb = texts[translation] === undefined;
          }
        }
        if (!live) return;
        setState({
          lead,
          passages: progress.passages,
          place: ref === null ? null : { ...ref, label: verseLabel(ref) },
          placePassage,
          excerpt,
          excerptBsb,
          away: backAfterGap(saved?.at ?? null, new Date()),
        });
      })();
      return () => {
        live = false;
      };
    }, [user, core, translation]),
  );

  const ot = BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "OT");
  const nt = BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "NT");
  const testament = chosenTestament ?? (state?.place != null && BOOK_CODES[state.place.book].testament === "NT" ? "nt" : "ot");
  const shown = testament === "ot" ? { title: "Old Testament", books: ot } : { title: "New Testament", books: nt };

  /**
   * Opens a passage's text with its guide over it (ON-02). Landed as a resumed place, so its
   * first verse is at the top and the reading place saved is this passage's, not the last one's.
   */
  const openGuided = (p: PericopeRow) => {
    const start = ordToParts(p.start_ord);
    router.push(readerHref({ book: start.book, chapter: start.chapter, verse: start.verse, resume: true, guide: p.pericope_id }));
  };

  // BI-30 keeps one control in the bar: Search, as the frame draws it.
  const right = <GlassIcon icon="search" label="Search" onPress={() => router.push("/search")} testID="home-search" />;

  /**
   * BH-01: one way to start. A serif heading over one card (the next passage where you are); the plan lives on Today
   * only, so there is no second row for it here and no passage count (UX pass, "Cleaner: one start, one verse").
   * Taken from Apple Books Home (https://mobbin.com/screens/ef25171d-f4a6-43ed-a0a2-375e835230f8): a serif heading
   * over one compact card, quiet shelves below.
   */
  const lead = (): ReactNode => {
    if (state === null) return null;
    const { lead: l, passages } = state;
    const first = passages[0];
    if (l.kind === "start") {
      return first === undefined ? null : (
        <StartCard
          heading="Start here"
          title="The Gospel of John"
          subtitle="One passage at a time, explained."
          action="Start"
          at={ordToParts(first.start_ord)}
          label="Start here. The Gospel of John, one passage at a time, explained. Opens the first passage"
          onPress={() => openGuided(first)}
          testID="home-start-here"
        />
      );
    }
    if (l.kind === "next") {
      const p = passages[l.passage];
      if (p === undefined) return null;
      const range = rangeInBook(p.pericope_id);
      return (
        <StartCard
          heading="Continue"
          title={`John ${range}`}
          subtitle={p.label}
          at={ordToParts(p.start_ord)}
          label={`Continue, next, ${p.label}, John ${spokenRange(range)}. Opens its guide`}
          onPress={() => openGuided(p)}
          testID="home-next"
        />
      );
    }
    const place = state.place;
    if (place === null) return null;
    const heading = state.away ? "Where you stopped" : "Continue";
    return (
      <>
        <StartCard
          heading={heading}
          // Under a licensed version the excerpt is the BSB's and says so; a passage heading is Yada's own, so no label.
          // BH-01 names the chapter ("Psalm 79"); the reader lands on the verse and holds it after a gap (MM-05).
          title={`${chapterTitle(place.book, place.chapter)}${state.placePassage === null && state.excerptBsb ? " · BSB" : ""}`}
          subtitle={state.placePassage ?? state.excerpt}
          at={place}
          // One element to VoiceOver: "Continue reading, The first disciples, John 1:39. “Come and see,”…" (brief §5).
          label={`${state.away ? "Where you stopped" : "Continue reading"}, ${state.placePassage === null ? "" : `${state.placePassage}, `}${place.label}. ${state.excerpt}`}
          onPress={() =>
            // Lands as a cold launch does (brief §8.18): the verse just below the header. After a gap
            // (MM-05) one verse above it, so the last verse read is in view, held for two seconds.
            router.push(
              readerHref(
                state.away
                  ? { book: place.book, chapter: place.chapter, verse: Math.max(1, place.verse - 1), resume: true, hold: place.verse }
                  : { book: place.book, chapter: place.chapter, verse: place.verse, resume: true },
              ),
            )
          }
          testID="home-continue"
        />
      </>
    );
  };

  return (
    // Titled Bible, as Today and Pray name their own tabs: the wordmark here was the one tab that didn't say where you
    // were (Sit audit, 24 Oct 2026).
    <PageScreen title="Bible" back={null} right={right} clearTabBar testID="home">
      {/* No padding under the lead: the books' label sits 28 pt below its hairline, as ON-01/05/07
          space it (canvas `.lbl` margin-top); 12 more opened a gap the frames don't have (QA). */}
      {paused ? (
        // NT-09: said once, in the app, never as another notification; gone after either choice.
        <View style={styles.paused} testID="home-reminder-paused">
          <Chrome step="note" tone="muted" accessibilityRole="text">
            Reminders paused while you were away.
          </Chrome>
          <View style={{ flexDirection: "row", columnGap: 16 }}>
            <Pressable onPress={() => void turnOn(user, core, reminderPrefs)} accessibilityRole="button" style={styles.pausedAction} testID="home-reminder-resume">
              <Chrome tone="accent" style={{ fontWeight: "600" }}>Resume</Chrome>
            </Pressable>
            <Pressable onPress={() => void turnOff(user)} accessibilityRole="button" style={styles.pausedAction} testID="home-reminder-off">
              <Chrome tone="accent" style={{ fontWeight: "600" }}>Turn off</Chrome>
            </Pressable>
          </View>
        </View>
      ) : askAgain ? (
        <View style={styles.paused} testID="home-reminder-ask">
          <Chrome step="note" tone="muted" accessibilityRole="text">
            A reminder to read each day?
          </Chrome>
          <View style={{ flexDirection: "row", columnGap: 16 }}>
            <Pressable
              onPress={() => {
                setAskAgain(false);
                void turnOnFromAsk(user, core, reminderPrefs);
              }}
              accessibilityRole="button"
              accessibilityHint="iPhone will ask to allow notifications"
              style={styles.pausedAction}
              testID="home-reminder-ask-on"
            >
              <Chrome tone="accent" style={{ fontWeight: "600" }}>Turn on</Chrome>
            </Pressable>
            <Pressable
              onPress={() => {
                setAskAgain(false);
                void notNow(user);
              }}
              accessibilityRole="button"
              style={styles.pausedAction}
              testID="home-reminder-ask-later"
            >
              <Chrome tone="accent" style={{ fontWeight: "600" }}>Not now</Chrome>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View>{lead()}</View>
      {/* RU-14: plans one tap from the Bible tab, under Continue (canvas RU-14). */}
      <ListRow first title="Reading plans" subtitle="John passage by passage · The whole Bible" onPress={() => router.push("/plans")} testID="home-plans" />

      {/* One testament at a time behind a switch, opening on the one you're reading: Matthew was 39 rows down (Sit audit,
          24 Oct 2026). YouVersion's Plans switches its lists the same way. */}
      <View style={{ marginTop: 26 }}>
        <Segmented
          options={[
            { value: "ot", label: "Old Testament" },
            { value: "nt", label: "New Testament" },
          ]}
          value={testament}
          onChange={setTestament}
          label="Testament"
          testID="home-testament"
        />
      </View>
      {/* BI-30: two to a row (one at AX sizes); a book's chapters open under the row that holds it. */}
      <View style={styles.books} accessibilityLabel={shown.title}>
        {chunk(shown.books, ax ? 1 : 2).map((pair) => {
          const opened = pair.find((b) => b === openBook);
          const meta = opened === undefined ? null : BOOK_CODES[opened];
          return (
            <View key={pair.join()} style={styles.bookRows}>
              <View style={styles.bookRow}>
                {pair.map((book) => (
                  <BookTile
                    key={book}
                    book={book}
                    reading={state?.place?.book === book}
                    open={openBook === book}
                    onPress={() => (BOOK_CODES[book].chapters === 1 ? router.push(readerHref({ book, chapter: 1 })) : setOpenBook(openBook === book ? null : book))}
                  />
                ))}
                {pair.length === 1 && !ax ? <View style={{ flex: 1 }} /> : null}
              </View>
              {/* RU-10 (approved by John, 23 Oct 2026): a book opens its chapters in place, so the Bible tab is one
                  tap from any chapter; the contents sheet stays for the reader's title. */}
              {opened === undefined || meta === null ? null : (
                <View style={{ paddingVertical: 6 }}>
                  <NumberGrid
                    numbers={Array.from({ length: meta.chapters }, (_, n) => n + 1)}
                    current={state?.place?.book === opened ? state.place.chapter : null}
                    onPick={(chapter) =>
                      chooseVerse
                        ? router.push({ pathname: "/contents/verses", params: { book: opened, chapter: String(chapter), from: "home" } })
                        : router.push(readerHref({ book: opened, chapter }))
                    }
                    label={(chapter) => `${meta.name} ${chapter}`}
                    testID={(chapter) => `chapter-${opened}-${chapter}`}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </PageScreen>
  );
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const chaptersLine = (n: number) => `${n} ${n === 1 ? "chapter" : "chapters"}`;

/** BI-30's book: the name in Literata, its chapter count from the canon (BOOK_CODES), "Reading ·" on yours. */
function BookTile({ book, reading, open, onPress }: { book: BookCode; reading: boolean; open: boolean; onPress: () => void }) {
  const palette = usePalette();
  const { ax } = useLayout();
  const meta = BOOK_CODES[book];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.name}, ${chaptersLine(meta.chapters)}${reading ? ", reading" : ""}`}
      accessibilityState={meta.chapters === 1 ? undefined : { expanded: open }}
      style={({ pressed }) => [styles.book, ax ? styles.bookAx : null, { backgroundColor: open ? palette.fill : palette.card, opacity: pressed ? 0.85 : 1 }]}
      testID={`book-${book}`}
    >
      <Chrome tone="ink" style={styles.bookName} maxFontSizeMultiplier={2} numberOfLines={2}>
        {meta.name}
      </Chrome>
      <Chrome step="note" tone="muted">
        {`${reading ? "Reading · " : ""}${chaptersLine(meta.chapters)}`}
      </Chrome>
    </Pressable>
  );
}

/**
 * BI-30's one card: what to read next, a tappable thing, so a card: 24 pt radius, a soft fill, no shadow (CLAUDE.md,
 * John 15 Oct 2026). Its kind over the chapter, the passage, Read, and the place in its book from the canon's chapter
 * count. One element to VoiceOver whose label names where it goes (WCAG 2.4.4); Read inside it is the same tap.
 */
function StartCard({
  heading,
  title,
  subtitle,
  label,
  at,
  action = "Read",
  onPress,
  testID,
}: {
  heading: string;
  title: string;
  subtitle: string;
  label: string;
  at: { readonly book: BookCode; readonly chapter: number };
  action?: string;
  onPress: () => void;
  testID: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  const chapters = BOOK_CODES[at.book].chapters;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Chapter ${at.chapter} of ${chapters}`}
      testID={testID}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.card, opacity: pressed ? 0.85 : 1 }]}
    >
      <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
        {heading}
      </Chrome>
      <View style={[styles.cardTop, ax ? { flexDirection: "column", alignItems: "flex-start" } : null]}>
        <View style={{ flex: ax ? undefined : 1, minWidth: 0, rowGap: 2 }}>
          <Chrome tone="ink" style={styles.cardTitle} maxFontSizeMultiplier={2}>
            {title}
          </Chrome>
          {subtitle !== "" ? (
            <Chrome tone="muted" numberOfLines={ax ? 3 : 1}>
              {subtitle}
            </Chrome>
          ) : null}
        </View>
        <Pill primary small title={action} onPress={onPress} testID={`${testID}-read`} />
      </View>
      <View style={[styles.track, { backgroundColor: palette.fill }]}>
        <View style={[styles.trackFill, { width: `${(100 * at.chapter) / chapters}%`, backgroundColor: palette.accent }]} />
      </View>
      <Chrome step="note" tone="muted" style={{ marginTop: 6 }}>
        {`Chapter ${at.chapter} of ${chapters}`}
      </Chrome>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  paused: { rowGap: 4, marginBottom: 20 },
  pausedAction: { minHeight: 44, justifyContent: "center" },
  card: { borderRadius: 24, padding: 18, minHeight: 44 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 4 },
  cardTitle: { fontFamily: FONTS.scripture, fontSize: 26, lineHeight: 32, fontWeight: "400", letterSpacing: -0.4 },
  track: { height: 4, borderRadius: 2, marginTop: 14, overflow: "hidden" },
  trackFill: { height: 4 },
  books: { marginTop: 12, rowGap: 8 },
  bookRows: { rowGap: 8 },
  bookRow: { flexDirection: "row", columnGap: 8 },
  // BI-30's tile: 64 pt (76 at AX sizes), 16 pt corners, the card fill.
  book: { flex: 1, minHeight: 64, justifyContent: "center", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16 },
  bookAx: { minHeight: 76 },
  bookName: { fontFamily: FONTS.scripture, fontSize: 19, lineHeight: 25 },
});

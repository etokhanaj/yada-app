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
 * VoiceOver order follows the eye (ON-06): Search, Bookmarks, More, the
 * wordmark, the lead, the books.
 */

import { BOOK_CODES, BOOK_ORDER, type BookCode, ordToParts, parseVerseId, verseOrd } from "@yada/schema";
import { MenuView } from "@react-native-menu/menu";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { NumberGrid } from "../../components/Contents";
import { GlassButton } from "../../components/Glass";
import { useLaunch } from "../../components/LaunchOverlay";
import { Icon } from "../../components/Icon";
import { readerHref } from "../../components/navigation";
import { GlassIcon, ListRow, PageScreen } from "../../components/Page";
import { Chrome } from "../../components/Type";
import { useAppData, useCore } from "../../data/AppData";
import { getTexts } from "../../data/queries";
import { notNow, shouldAsk, turnOff, turnOn, turnOnFromAsk, useReminder } from "../../data/reminder";
import { loadProgress } from "../../data/startHere";
import { loadPericopes } from "../../data/understand";
import { decideReturn, stampOpen } from "../../data/lapse";
import { loadPositionAt } from "../../data/user";
import { FONTS, useIsDark, useLayout, usePalette } from "../../design/tokens";
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
  const palette = usePalette();
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

  /**
   * Opens a passage's text with its guide over it (ON-02). Landed as a resumed place, so its
   * first verse is at the top and the reading place saved is this passage's, not the last one's.
   */
  const openGuided = (p: PericopeRow) => {
    const start = ordToParts(p.start_ord);
    router.push(readerHref({ book: start.book, chapter: start.chapter, verse: start.verse, resume: true, guide: p.pericope_id }));
  };

  const right = (
    <>
      <GlassIcon icon="bookmark" label="Saved" onPress={() => router.push("/saved")} testID="home-saved" />
      <MenuView
        shouldOpenOnLongPress={false}
        actions={[
          // An action without imageColor reaches native as colour 0, transparent: @react-native-menu
          // 2.0's Fabric view always sends the field, so the icons were drawn invisible (10 Oct 2026).
          // IA-11: Recent · Settings; Sources and the reminder live in Settings now. Reading plans left the menu for a
          // row under Continue (RU-14, approved by John 23 Oct 2026): in the menu a new reader never found them.
          { id: "recent", title: "Recent", image: "clock", imageColor: palette.ink },
          { id: "settings", title: "Settings", image: "gearshape", imageColor: palette.ink },
        ]}
        onPressAction={({ nativeEvent }) => router.push(nativeEvent.event === "recent" ? "/recent" : "/settings")}
        testID="home-more"
      >
        {/* The menu is a UIButton; a child that took the touch would keep it from opening. */}
        <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel="More: Recent, Settings">
          <GlassButton>
            <Icon name="more" size={20} />
          </GlassButton>
        </View>
      </MenuView>
    </>
  );

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
    <PageScreen title="Yada" titleNode={<Wordmark />} back={null} right={right} clearTabBar testID="home">
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

      {[
        { title: "Old Testament", books: ot },
        { title: "New Testament", books: nt },
      ].map((group) => (
        <View key={group.title} style={{ marginTop: 26 }}>
          <Heading style={{ marginBottom: 6 }}>{group.title}</Heading>
          {group.books.map((book, i) => {
            const meta = BOOK_CODES[book];
            const open = openBook === book;
            return (
              <View key={book}>
                <ListRow
                  first={i === 0}
                  book
                  chevron={false}
                  title={meta.name}
                  label={`${meta.name}, ${meta.chapters} ${meta.chapters === 1 ? "chapter" : "chapters"}${open ? ", chapters shown" : ""}`}
                  onPress={() => (meta.chapters === 1 ? router.push(readerHref({ book, chapter: 1 })) : setOpenBook(open ? null : book))}
                  testID={`book-${book}`}
                />
                {/* RU-10 (approved by John, 23 Oct 2026): a book opens its chapters in place, so the Bible tab is one
                    tap from any chapter; the contents sheet stays for the reader's title. */}
                {open ? (
                  <View style={{ paddingBottom: 14 }}>
                    <NumberGrid
                      numbers={Array.from({ length: meta.chapters }, (_, n) => n + 1)}
                      current={state?.place?.book === book ? state.place.chapter : null}
                      onPick={(chapter) =>
                        chooseVerse
                          ? router.push({ pathname: "/contents/verses", params: { book, chapter: String(chapter), from: "home" } })
                          : router.push(readerHref({ book, chapter }))
                      }
                      label={(chapter) => `${meta.name} ${chapter}`}
                      testID={(chapter) => `chapter-${book}-${chapter}`}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </PageScreen>
  );
}

/** A serif section heading (BH-01): "Continue", "Old Testament". */
function Heading({ children, style }: { children: string; style?: object }) {
  return (
    <Chrome tone="ink" accessibilityRole="header" maxFontSizeMultiplier={2} style={[styles.heading, style]}>
      {children}
    </Chrome>
  );
}

/**
 * The one card (BH-01): what to read next, a tappable thing, so a card: 24 pt radius, a soft fill, no shadow
 * (CLAUDE.md, John 15 Oct 2026). One element to VoiceOver whose label names where it goes (WCAG 2.4.4).
 */
function StartCard({
  heading,
  title,
  subtitle,
  label,
  onPress,
  testID,
}: {
  heading: string;
  title: string;
  subtitle: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <View>
      <Heading>{heading}</Heading>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        style={({ pressed }) => [styles.card, { backgroundColor: palette.card, opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>
          <Chrome tone="ink" style={styles.cardTitle} maxFontSizeMultiplier={2}>
            {title}
          </Chrome>
          {subtitle !== "" ? (
            <Chrome tone="muted" numberOfLines={ax ? 3 : 1}>
              {subtitle}
            </Chrome>
          ) : null}
        </View>
        <Icon name="forward" size={18} tone="muted" />
      </Pressable>
    </View>
  );
}

/**
 * The outlined wordmark as Home's title (brief §8.15): forest on chalk, chalk
 * in dark. 44 pt tall, growing with Dynamic Type to 72 at AX5 (canvas
 * .wordmark). Rasters from the high-resolution export, sized for 72 pt at 3x.
 */
function Wordmark() {
  const isDark = useIsDark();
  const { fontScale } = useWindowDimensions();
  const height = 44 * Math.min(Math.max(fontScale, 1), 72 / 44);
  return (
    <Image
      source={isDark ? require("../../../assets/brand/wordmark-chalk.png") : require("../../../assets/brand/wordmark-forest.png")}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Yada"
      style={{ width: (height * 320) / 130, height, marginLeft: -4, marginBottom: 4 }}
      testID="home-wordmark"
    />
  );
}

const styles = StyleSheet.create({
  paused: { rowGap: 4, marginBottom: 20 },
  pausedAction: { minHeight: 44, justifyContent: "center" },
  heading: { fontFamily: FONTS.scripture, fontSize: 24, lineHeight: 30, fontWeight: "600", letterSpacing: -0.4, marginBottom: 10 },
  card: { flexDirection: "row", alignItems: "center", columnGap: 12, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20, minHeight: 44 },
  cardTitle: { fontFamily: FONTS.scripture, fontSize: 26, lineHeight: 29, fontWeight: "600", letterSpacing: -0.4 },
  progress: {
    marginTop: 4,
    marginBottom: 2,
  },
});

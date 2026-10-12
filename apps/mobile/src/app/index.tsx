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

import { GlassButton } from "../components/Glass";
import { useLaunch } from "../components/LaunchOverlay";
import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { GlassIcon, ListRow, PageScreen } from "../components/Page";
import { Chrome, Label, Scripture } from "../components/Type";
import { DivineText } from "../components/Verse";
import { useAppData, useCore } from "../data/AppData";
import { getTexts } from "../data/queries";
import { loadProgress } from "../data/startHere";
import { loadPericopes } from "../data/understand";
import { loadPosition } from "../data/user";
import { FONTS, useIsDark, useLayout, usePalette } from "../design/tokens";
import { pericopeForVerse, type PericopeRow } from "../lib/pericopes";
import { excerptOf } from "../lib/reader";
import { rangeInBook, verseLabel } from "../lib/saved";
import { homeLead, type HomeLead, progressLabel, progressLine } from "../lib/startHere";
import { useSettings } from "../state/settings";

interface LeadState {
  readonly lead: HomeLead;
  readonly passages: readonly PericopeRow[];
  readonly readCount: number;
  /** Continue's place. */
  readonly place: { readonly book: BookCode; readonly chapter: number; readonly verse: number; readonly label: string } | null;
  /** The passage holding the place, in its own book, when that book has passages. */
  readonly placePassage: string | null;
  readonly excerpt: string;
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

  // A cold launch with a saved position opens the reader there (brief §8.18, decided by John
  // 10 Oct), Home beneath it. With none, Home is the first screen: it is the start (ON-01),
  // replacing the old first launch into John 1 (decision 1, JN-01). Once per process: Home can
  // remount (Page's back falls back to `replace("/")`), and that must not throw the reader
  // forward again. A warm resume never remounts anything, so it keeps whatever was on screen.
  useEffect(() => {
    if (useLaunch.getState().routed) return;
    useLaunch.getState().markRouted();
    if (!returning) useSettings.getState().markLaunched();
    void loadPosition(user).then((id) => {
      const position = id === null ? null : parseVerseId(id);
      if (position !== null) {
        // Someone who read before this build skips the first-visit hint.
        if (!returning) useSettings.getState().markHintSeen();
        router.push(readerHref({ book: position.book, chapter: position.chapter, verse: position.verse, resume: true }));
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
        const [id, progress] = await Promise.all([loadPosition(user), loadProgress(user)]);
        const ref = id === null ? null : parseVerseId(id);
        const ord = ref === null ? null : verseOrd(ref.book, ref.chapter, ref.verse);
        const lead = homeLead({
          passages: progress.passages,
          read: progress.read,
          lastFinished: progress.lastFinished,
          place: ref === null || ord === null ? null : { book: ref.book, ord },
        });
        let excerpt = "";
        let placePassage: string | null = null;
        if (lead.kind === "continue" && ref !== null && ord !== null) {
          const [texts, own] = await Promise.all([getTexts(core, ord), loadPericopes(ref.book)]);
          excerpt = excerptOf(texts[translation] ?? texts["BSB"] ?? "");
          placePassage = pericopeForVerse(own, ord)?.label ?? null;
        } else if (lead.kind === "next") {
          const p = progress.passages[lead.passage];
          if (p !== undefined) {
            const texts = await getTexts(core, p.start_ord);
            excerpt = excerptOf(texts[translation] ?? texts["BSB"] ?? "");
          }
        }
        if (!live) return;
        setState({
          lead,
          passages: progress.passages,
          readCount: progress.read.size,
          place: ref === null ? null : { ...ref, label: verseLabel(ref) },
          placePassage,
          excerpt,
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
      <GlassIcon icon="search" label="Search" onPress={() => router.push("/search")} testID="home-search" />
      <GlassIcon icon="bookmark" label="Bookmarks" onPress={() => router.push("/bookmarks")} testID="home-bookmarks" />
      <MenuView
        shouldOpenOnLongPress={false}
        actions={[
          // An action without imageColor reaches native as colour 0, transparent: @react-native-menu
          // 2.0's Fabric view always sends the field, so the icons were drawn invisible (10 Oct 2026).
          { id: "recent", title: "Recent", image: "clock", imageColor: palette.ink },
          { id: "sources", title: "Sources", image: "books.vertical", imageColor: palette.ink },
        ]}
        onPressAction={({ nativeEvent }) => router.push(nativeEvent.event === "recent" ? "/recent" : "/sources")}
        testID="home-more"
      >
        {/* The menu is a UIButton; a child that took the touch would keep it from opening. */}
        <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel="More: Recent, Sources">
          <GlassButton>
            <Icon name="more" size={20} />
          </GlassButton>
        </View>
      </MenuView>
    </>
  );

  const lead = (): ReactNode => {
    if (state === null) return null;
    const { lead: l, passages } = state;
    const total = passages.length;
    const first = passages[0];
    if (l.kind === "start") {
      return first === undefined ? null : (
        <Lead
          overline="Start here"
          title="The Gospel of John"
          excerpt="One passage at a time, explained."
          label="Start here. The Gospel of John, one passage at a time, explained. Opens the first passage"
          onPress={() => openGuided(first)}
          testID="home-start-here"
        />
      );
    }
    const all = (
      <ListRow
        first
        onPress={() => router.push("/thread")}
        // ON-05/ON-07 set this row in medium (`.valrow`): it is a way in, not a book.
        title={<Chrome tone="ink" style={{ fontWeight: "500" }}>All passages in John</Chrome>}
        label="All passages in John"
        testID="home-all-passages"
      />
    );
    if (l.kind === "next") {
      const p = passages[l.passage];
      if (p === undefined) return null;
      const range = rangeInBook(p.pericope_id);
      return (
        <>
          <Lead
            overline={`Next · John ${range}`}
            title={p.label}
            excerpt={state.excerpt}
            label={`Next, ${p.label}, John ${spokenRange(range)}. Opens its guide`}
            onPress={() => openGuided(p)}
            testID="home-next"
          />
          <Chrome step="note" tone="muted" style={styles.progress} accessibilityLabel={progressLabel(state.readCount, total)} testID="home-progress">
            {progressLine(state.readCount, total)}
          </Chrome>
          {all}
        </>
      );
    }
    const place = state.place;
    if (place === null) return null;
    const johnNext = l.johnNext === null ? null : passages[l.johnNext];
    return (
      <>
        <Lead
          overline={`Continue · ${place.label}`}
          title={state.placePassage ?? place.label}
          excerpt={state.excerpt}
          // One element to VoiceOver: "Continue reading, The first disciples, John 1:39. “Come and see,”…" (brief §5).
          label={`Continue reading, ${state.placePassage === null ? "" : `${state.placePassage}, `}${place.label}. ${state.excerpt}`}
          onPress={() =>
            // Lands as a cold launch does (brief §8.18): the verse just below the header.
            router.push(readerHref({ book: place.book, chapter: place.chapter, verse: place.verse, resume: true }))
          }
          testID="home-continue"
        />
        {johnNext !== null && johnNext !== undefined ? (
          // Edge case 1: reading outside John, the thread waits as one quiet row, not a second lead.
          <ListRow
            first
            onPress={() => openGuided(johnNext)}
            overline={`Next in John · ${rangeInBook(johnNext.pericope_id)}`}
            title={johnNext.label}
            label={`Next in John, ${johnNext.label}, John ${spokenRange(rangeInBook(johnNext.pericope_id))}. Opens its guide`}
            testID="home-john-next"
          />
        ) : null}
        {l.passage !== null || state.readCount > 0 ? (
          <Chrome step="note" tone="muted" style={styles.progress} accessibilityLabel={progressLabel(state.readCount, total)} testID="home-progress">
            {progressLine(state.readCount, total)}
          </Chrome>
        ) : null}
        {all}
      </>
    );
  };

  return (
    <PageScreen title="Yada" titleNode={<Wordmark />} back={null} right={right} testID="home">
      {/* No padding under the lead: the books' label sits 28 pt below its hairline, as ON-01/05/07
          space it (canvas `.lbl` margin-top); 12 more opened a gap the frames don't have (QA). */}
      <View>{lead()}</View>

      {[
        { title: "Old Testament", books: ot },
        { title: "New Testament", books: nt },
      ].map((group) => (
        <View key={group.title} style={{ marginTop: 28 }}>
          <Label style={{ marginBottom: 6 }}>{group.title}</Label>
          {group.books.map((book, i) => (
            <ListRow
              key={book}
              first={i === 0}
              book
              chevron={false}
              title={BOOK_CODES[book].name}
              label={`${BOOK_CODES[book].name}, ${BOOK_CODES[book].chapters} ${BOOK_CODES[book].chapters === 1 ? "chapter" : "chapters"}`}
              onPress={() =>
                BOOK_CODES[book].chapters === 1
                  ? router.push(readerHref({ book, chapter: 1 }))
                  : router.push({ pathname: "/contents/[book]", params: { book, from: "home" } })
              }
              testID={`book-${book}`}
            />
          ))}
        </View>
      ))}
    </PageScreen>
  );
}

/**
 * The lead (canvas `.lead.coverlead`): a small overline that says what it is,
 * the title in Literata semibold, one muted line of excerpt, a chevron. One
 * element to VoiceOver whose label names where it goes (WCAG 2.4.4).
 */
function Lead({
  overline,
  title,
  excerpt,
  label,
  onPress,
  testID,
}: {
  overline: string;
  title: string;
  excerpt: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.leadRow,
        { boxShadow: `0 1px 0 ${palette.divider}` },
        pressed ? { backgroundColor: palette.fill } : null,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Label accessibilityRole="text">{overline}</Label>
        <Chrome tone="ink" style={styles.leadTitle} maxFontSizeMultiplier={2}>
          <DivineText text={title} />
        </Chrome>
        {excerpt !== "" ? (
          <Scripture step="claim" tone="muted" numberOfLines={ax ? 3 : 1} style={{ fontFamily: FONTS.scripture }}>
            {excerpt}
          </Scripture>
        ) : null}
      </View>
      <Icon name="forward" size={18} tone="muted" />
    </Pressable>
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
      source={isDark ? require("../../assets/brand/wordmark-chalk.png") : require("../../assets/brand/wordmark-forest.png")}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Yada"
      style={{ width: (height * 320) / 130, height, marginLeft: -4, marginBottom: 4 }}
      testID="home-wordmark"
    />
  );
}

const styles = StyleSheet.create({
  leadRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    columnGap: 12,
    paddingTop: 14,
    paddingBottom: 22,
    marginBottom: 6,
  },
  leadTitle: {
    fontFamily: FONTS.scripture,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "600",
    letterSpacing: -0.4,
    marginTop: 6,
    marginBottom: 4,
  },
  progress: {
    marginTop: 4,
    marginBottom: 2,
  },
});

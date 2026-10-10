/**
 * Home (canvas H-01, H-02): a serif `Yada`, three glass icons, then one lead
 * row — `Start with John` on first launch, `Continue` once there is a place to
 * return to — and the books. Apple Books Home, cut down
 * (https://mobbin.com/screens/ef25171d-f4a6-43ed-a0a2-375e835230f8).
 *
 * Start here stays under Continue until the thread is started (brief §4).
 * Books carry no chapter counts (audit); Contents shows the chapters.
 */

import { BOOK_CODES, BOOK_ORDER, parseVerseId, verseOrd } from "@yada/schema";
import { MenuView } from "@react-native-menu/menu";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";

import { GlassButton } from "../components/Glass";
import { useLaunch } from "../components/LaunchOverlay";
import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { GlassIcon, ListRow, PageScreen } from "../components/Page";
import { Cover, coverLabel } from "../components/Cover";
import { Chrome, Label, Scripture } from "../components/Type";
import { useAppData, useCore, useQuery } from "../data/AppData";
import { getTexts } from "../data/queries";
import { loadPassageCover, loadPericopes, type PassageCover } from "../data/understand";
import { loadPosition, loadThreadStep } from "../data/user";
import { useIsDark, useLayout } from "../design/tokens";
import { excerptOf } from "../lib/reader";
import { verseLabel } from "../lib/saved";
import { useSettings } from "../state/settings";

interface ContinueState {
  readonly verseId: string;
  readonly label: string;
  readonly excerpt: string;
  readonly cover: PassageCover | null;
}

export default function Home() {
  const core = useCore();
  const { user } = useAppData();
  const { ax } = useLayout();
  const translation = useSettings((s) => s.translation);
  const launched = useSettings((s) => s.launched);
  // Read once at mount: the effect below marks the first launch before Home's data loads.
  const returning = useRef(launched).current;
  const [continueAt, setContinueAt] = useState<ContinueState | null>(null);
  const [threadStep, setThreadStep] = useState(0);
  const { data: johnPassages } = useQuery(async () => (await loadPericopes("JHN")).length, []);
  // Depth (§8.14): John's first passage is Start with John's cover.
  const { data: johnCover } = useQuery(() => loadPassageCover(core, "JHN", verseOrd("JHN", 1, 1)), []);

  // Decision 1 (JN-01): the first launch opens the reader at John 1, not Home.
  // Home stays beneath it, so the reader's `‹ Home` is the way here. Someone
  // who read before this build already has a position and keeps Home.
  useEffect(() => {
    if (launched) return;
    useSettings.getState().markLaunched();
    void loadPosition(user).then((position) => {
      if (position === null) router.push(readerHref({ book: "JHN", chapter: 1 }));
      else useSettings.getState().markHintSeen();
    });
  }, [launched, user]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        try {
          const id = await loadPosition(user);
          const ref = id === null ? null : parseVerseId(id);
          if (ref === null || id === null) {
            if (live) setContinueAt(null);
          } else {
            const ord = verseOrd(ref.book, ref.chapter, ref.verse);
            const [texts, cover] = await Promise.all([getTexts(core, ord), loadPassageCover(core, ref.book, ord)]);
            if (live) setContinueAt({ verseId: id, label: verseLabel(ref), excerpt: excerptOf(texts[translation] ?? ""), cover });
          }
          const step = await loadThreadStep(user, "start-here-john");
          if (live) setThreadStep(step);
        } finally {
          // A returning reader lands on Home: once its rows can draw (or fail to), the launch
          // overlay lifts (§8.17). On first launch the reader at John 1 does that instead.
          if (returning) useLaunch.getState().markReady();
        }
      })();
      return () => {
        live = false;
      };
    }, [user, core, translation, returning]),
  );

  const resume = continueAt === null ? null : parseVerseId(continueAt.verseId);
  const ot = BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "OT");
  const nt = BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "NT");
  const passages = johnPassages ?? 0;

  const startWithJohn = (first: boolean) =>
    johnCover !== undefined && johnCover !== null && first ? (
      <ListRow
        first
        onPress={() => router.push("/thread")}
        label={`Start with John. ${coverLabel(johnCover)}. ${passages} passages, in order`}
        testID="home-start-here"
      >
        <Cover cover={johnCover} label={<Label accessibilityRole="text">Start with John</Label>} />
      </ListRow>
    ) : (
      <ListRow
        first={first}
        onPress={() => router.push("/thread")}
        label={`Start with John, ${passages} passages, in order`}
        testID="home-start-here"
        title={
          <Chrome tone="ink" style={styles.leadTitle} maxFontSizeMultiplier={2.2}>
            Start with John
          </Chrome>
        }
        subtitle={`${passages} passages, in order`}
      />
    );

  const right = (
    <>
      <GlassIcon icon="search" label="Search" onPress={() => router.push("/search")} testID="home-search" />
      <GlassIcon icon="bookmark" label="Bookmarks" onPress={() => router.push("/bookmarks")} testID="home-bookmarks" />
      <MenuView
        shouldOpenOnLongPress={false}
        actions={[
          { id: "recent", title: "Recent", image: "clock" },
          { id: "sources", title: "Sources", image: "books.vertical" },
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

  return (
    <PageScreen title="Yada" titleNode={<Wordmark />} back={null} right={right} testID="home">
      <View style={styles.lead}>
        {continueAt !== null && resume !== null ? (
          <ListRow
            first
            onPress={() => router.push(readerHref({ book: resume.book, chapter: resume.chapter, verse: resume.verse }))}
            // One element to VoiceOver: "Continue reading, John 8:2. Early in the morning…" (brief §5).
            label={`Continue reading, ${continueAt.label}. ${continueAt.cover === null ? "" : `${coverLabel(continueAt.cover)}. `}${continueAt.excerpt}`}
            testID="home-continue"
          >
            {continueAt.cover !== null ? (
              <>
                <Cover
                  cover={continueAt.cover}
                  label={<Label accessibilityRole="text">Continue · {continueAt.label}</Label>}
                  footer={continueAt.cover.word !== null}
                />
                {continueAt.cover.word === null && continueAt.excerpt !== "" ? (
                  <Scripture step="claim" tone="muted" numberOfLines={ax ? 3 : 1} style={{ fontFamily: "Literata" }}>
                    {continueAt.excerpt}
                  </Scripture>
                ) : null}
              </>
            ) : (
              <>
                <Label accessibilityRole="text">Continue</Label>
                <Chrome tone="ink" style={styles.leadTitle} maxFontSizeMultiplier={2.2}>
                  {continueAt.label}
                </Chrome>
                {continueAt.excerpt !== "" ? (
                  <Scripture step="claim" tone="muted" numberOfLines={ax ? 3 : 1} style={{ fontFamily: "Literata" }}>
                    {continueAt.excerpt}
                  </Scripture>
                ) : null}
              </>
            )}
          </ListRow>
        ) : (
          startWithJohn(true)
        )}
        {continueAt !== null && threadStep === 0 ? startWithJohn(false) : null}
      </View>

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
 * The outlined wordmark as Home's title (brief §8.15): forest on chalk, chalk
 * in dark. 44 pt tall, growing with Dynamic Type to 72 at AX5 (canvas
 * .wordmark). Rasters, kept from the kit at 1x–3x.
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
      style={{ width: (height * 88) / 35, height, marginLeft: -4, marginBottom: 4 }}
      testID="home-wordmark"
    />
  );
}

const styles = StyleSheet.create({
  lead: {
    paddingBottom: 12,
  },
  leadTitle: {
    fontFamily: "Literata",
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
});

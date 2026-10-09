/**
 * Home: Apple Books Home, cut down — a large serif title, one Continue block,
 * Start here, then the books
 * (https://mobbin.com/screens/fa54930d-72ec-44e1-b65d-f8b50aa6e173).
 *
 * The header is three quiet words: Search · Bookmarks · ⋯. No bottom nav.
 */

import { BOOK_CODES, formatDisplayRef, parseVerseId, verseOrd } from "@yada/schema";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookChapterList } from "../components/BookChapterList";
import { readerHref } from "../components/navigation";
import { LargeTitle } from "../components/PageHeader";
import { Chrome, Label, Prose, Scripture } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { getTexts } from "../data/queries";
import { loadPosition, loadThreadStep } from "../data/user";
import { SPACE, usePalette } from "../design/tokens";
import { useSettings } from "../state/settings";

interface ContinueState {
  readonly verseId: string;
  readonly label: string;
  readonly excerpt: string;
}

export default function Home() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const [continueAt, setContinueAt] = useState<ContinueState | null>(null);
  const [threadStep, setThreadStep] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const id = await loadPosition(user);
        const ref = id === null ? null : parseVerseId(id);
        if (ref === null || id === null) {
          if (live) setContinueAt(null);
        } else {
          const texts = await getTexts(core, verseOrd(ref.book, ref.chapter, ref.verse));
          if (live) setContinueAt({ verseId: id, label: formatDisplayRef(ref), excerpt: texts[translation] ?? "" });
        }
        const step = await loadThreadStep(user, "start-here-john");
        if (live) setThreadStep(step);
      })();
      return () => {
        live = false;
      };
    }, [user, core, translation]),
  );

  function more(): void {
    const options = ["Recently explored", "Understand books", "Sources & licences", "Cancel"];
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 3 }, (index) => {
      if (index === 0) router.push("/explored");
      else if (index === 1) router.push("/library");
      else if (index === 2) router.push({ pathname: "/library", params: { section: "sources" } });
    });
  }

  const resume = continueAt === null ? null : parseVerseId(continueAt.verseId);

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
    <ScrollView
      style={{ backgroundColor: palette.paper }}
      contentContainerStyle={{ paddingTop: insets.top + SPACE.sm, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxl }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.push("/search")} hitSlop={10} accessibilityRole="button" testID="home-search">
          <Chrome size={16}>Search</Chrome>
        </Pressable>
        <Pressable onPress={() => router.push("/bookmarks")} hitSlop={10} accessibilityRole="button" testID="home-bookmarks">
          <Chrome size={16}>Bookmarks</Chrome>
        </Pressable>
        <Pressable onPress={more} hitSlop={10} accessibilityRole="button" accessibilityLabel="More" testID="home-more">
          <Chrome size={16}>⋯</Chrome>
        </Pressable>
      </View>

      <View style={{ marginTop: SPACE.md }}>
        <LargeTitle>Yada</LargeTitle>
      </View>

      <Pressable
        onPress={() =>
          router.push(
            resume === null
              ? readerHref({ book: "JHN", chapter: 1 })
              : readerHref({ book: resume.book, chapter: resume.chapter, verse: resume.verse }),
          )
        }
        style={({ pressed }) => [styles.block, { borderColor: palette.divider }, pressed ? { backgroundColor: palette.selection } : null]}
        accessibilityRole="button"
        testID="home-continue"
      >
        <Label>{continueAt === null ? "Begin reading" : "Continue reading"}</Label>
        <Prose step="explanation" style={{ marginTop: SPACE.sm, fontWeight: "600" }}>
          {continueAt?.label ?? "John 1"}
        </Prose>
        {continueAt !== null && continueAt.excerpt !== "" ? (
          <Scripture tone="muted" numberOfLines={2} style={{ marginTop: SPACE.xs }}>
            {continueAt.excerpt}
          </Scripture>
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => router.push("/thread")}
        style={({ pressed }) => [styles.thread, { borderColor: palette.divider }, pressed ? { backgroundColor: palette.selection } : null]}
        accessibilityRole="button"
        testID="home-start-here"
      >
        <Label>Start here</Label>
        <Prose step="claim" style={{ marginTop: SPACE.xs }}>
          The Gospel of John, passage by passage
        </Prose>
        {threadStep > 0 ? (
          <Prose step="note" tone="muted" style={{ marginTop: SPACE.xs }}>
            Passage {threadStep + 1} next
          </Prose>
        ) : null}
      </Pressable>

      <View style={{ marginTop: SPACE.xl }}>
        <BookChapterList onPick={(book, chapter) => router.push(readerHref({ book, chapter }))} />
      </View>

      <Prose step="note" tone="muted" style={{ marginTop: SPACE.xl, textAlign: "center" }}>
        {Object.keys(BOOK_CODES).length} books · Hebrew, Greek and three English translations, offline
      </Prose>
    </ScrollView>
    {/* Paper under the status bar, so the list never scrolls beneath the clock. */}
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: palette.paper }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: SPACE.lg,
    rowGap: SPACE.xs,
    minHeight: 32,
  },
  block: {
    marginTop: SPACE.lg,
    paddingVertical: SPACE.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thread: {
    paddingVertical: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

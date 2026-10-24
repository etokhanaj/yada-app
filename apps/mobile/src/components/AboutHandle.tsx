/**
 * The book's introduction, out of the way of the verses (SC-01, SC-05, SC-07; John, 17 Oct 2026: the paragraph above
 * chapter 1 was too much). Opening a book at chapter 1, a quiet "About John" handle waits at the bottom; a tap or a
 * drag up opens the paragraph in a sheet. It steps away once reading starts, and a book whose introduction John has not
 * approved has no handle at all (rule 2).
 */

import { BOOK_CODES, type BookCode } from "@yada/schema";
import { router } from "expo-router";
import { useRef } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";

import { useQuery } from "../data/AppData";
import { loadBookIntro, useUnderstand } from "../data/understand";
import { usePalette } from "../design/tokens";
import type { BookIntro } from "../lib/bookIntro";
import { Chrome } from "./Type";

/** The approved introduction, or null: none, not approved, or the book's Understand file is not on the phone. */
export function useBookIntro(book: BookCode): BookIntro | null {
  const file = useUnderstand((s) => s.installed[book]?.file ?? null);
  const { data } = useQuery(async () => (file === null ? null : loadBookIntro(book)), [book, file]);
  return data ?? null;
}

export function openAbout(book: BookCode): void {
  router.push({ pathname: "/about", params: { book } });
}

export function AboutHandle({ book, bottom }: { book: BookCode; bottom: number }) {
  const palette = usePalette();
  const name = BOOK_CODES[book].name;
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -24) openAbout(book);
      },
    }),
  ).current;
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none" testID="about-handle">
      {/* The verses fade under it, as the frame draws (style-v2 .peek). */}
      <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: `linear-gradient(${palette.paper}00, ${palette.paper} 38%)` }]} pointerEvents="none" />
      <View {...drag.panHandlers} style={styles.inner}>
        <View style={[styles.grab, { backgroundColor: palette.divider }]} />
        <Pressable onPress={() => openAbout(book)} accessibilityRole="button" accessibilityLabel={`About ${name}. Opens the book’s introduction`} style={styles.button}>
          <Chrome tone="muted" style={{ fontWeight: "600" }}>{`About ${name}`}</Chrome>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, paddingTop: 26, paddingBottom: 10, alignItems: "center", zIndex: 2 },
  inner: { alignItems: "center" },
  grab: { width: 36, height: 5, borderRadius: 3, marginBottom: 4 },
  button: { minHeight: 44, paddingHorizontal: 18, justifyContent: "center" },
});


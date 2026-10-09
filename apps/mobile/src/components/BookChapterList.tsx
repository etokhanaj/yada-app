/**
 * Book list with the chapter grid inline: tap a book, its chapters open under
 * it; tap a chapter, go. Apple Books contents sheet and Fable contents
 * (https://mobbin.com/screens/3f69946c-6ee0-499d-970f-2858d5e846d2,
 * https://mobbin.com/screens/a52dd380-49fa-4ad8-9e61-dad04a724cb5), used both
 * in the reader's contents sheet and on Home.
 */

import { BOOK_CODES, BOOK_ORDER, type BookCode } from "@yada/schema";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SPACE, usePalette } from "../design/tokens";
import { Chrome, Label, Prose } from "./Type";

export function BookChapterList({
  current,
  onPick,
  onCurrentLayout,
}: {
  current?: { book: BookCode; chapter: number };
  onPick: (book: BookCode, chapter: number) => void;
  /** y of the current book's row within this list, so a sheet can open scrolled to it. */
  onCurrentLayout?: (y: number) => void;
}) {
  const [open, setOpen] = useState<BookCode | null>(current?.book ?? null);
  const ot = BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "OT");
  const nt = BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "NT");

  const renderBook = (book: BookCode) => (
    <BookRow
      key={book}
      book={book}
      open={open === book}
      current={current?.book === book ? current.chapter : null}
      onToggle={() => {
        if (BOOK_CODES[book].chapters === 1) onPick(book, 1);
        else setOpen((was) => (was === book ? null : book));
      }}
      onPick={onPick}
      onLayoutY={current?.book === book ? onCurrentLayout : undefined}
    />
  );

  return (
    <View>
      <Label style={{ marginBottom: SPACE.sm }}>Old Testament</Label>
      {ot.map(renderBook)}
      <Label style={{ marginTop: SPACE.xl, marginBottom: SPACE.sm }}>New Testament</Label>
      {nt.map(renderBook)}
    </View>
  );
}

function BookRow({
  book,
  open,
  current,
  onToggle,
  onPick,
  onLayoutY,
}: {
  book: BookCode;
  open: boolean;
  current: number | null;
  onToggle: () => void;
  onPick: (book: BookCode, chapter: number) => void;
  onLayoutY?: (y: number) => void;
}) {
  const palette = usePalette();
  const meta = BOOK_CODES[book];
  return (
    <View
      style={[styles.bookRow, { borderTopColor: palette.divider }]}
      onLayout={onLayoutY === undefined ? undefined : (e) => onLayoutY(e.nativeEvent.layout.y)}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.bookPress, pressed ? { backgroundColor: palette.selection } : null]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${meta.name}, ${meta.chapters} ${meta.chapters === 1 ? "chapter" : "chapters"}`}
        testID={`book-${book}`}
      >
        <Prose step="claim" tone={current !== null ? "accent" : "ink"} style={{ flexShrink: 1 }}>
          {meta.name}
        </Prose>
        <Prose step="note" tone="muted">
          {meta.chapters}
        </Prose>
      </Pressable>
      {open ? (
        <View style={styles.grid}>
          {Array.from({ length: meta.chapters }, (_, i) => i + 1).map((chapter) => (
            <Pressable
              key={chapter}
              onPress={() => onPick(book, chapter)}
              style={({ pressed }) => [
                styles.cell,
                { borderColor: palette.divider },
                pressed || chapter === current ? { backgroundColor: palette.selection } : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${meta.name} chapter ${chapter}`}
              testID={`chapter-${book}-${chapter}`}
            >
              <Chrome size={16} tone={chapter === current ? "accent" : "ink"}>
                {chapter}
              </Chrome>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bookRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bookPress: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: SPACE.md - 2,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
    columnGap: SPACE.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
    paddingBottom: SPACE.md,
  },
  cell: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: SPACE.sm,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});

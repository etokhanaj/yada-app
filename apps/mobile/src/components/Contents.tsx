/**
 * Pieces of the Contents sheet: the Translation row with ⋯ beside it, the number grid, and picking a place.
 * ChatGPT's and Fable's contents sheets
 * (https://mobbin.com/screens/459b8d99-a0cb-4824-849a-356eea753cf2,
 * https://mobbin.com/screens/a52dd380-49fa-4ad8-9e61-dad04a724cb5).
 */

import { MenuView } from "@react-native-menu/menu";
import type { BookCode } from "@yada/schema";
import { router, useNavigation } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useTranslationName } from "../data/translations";
import { useLayout, usePalette } from "../design/tokens";
import { useSettings } from "../state/settings";
import { Icon } from "./Icon";
import { readerHref, useSheetNav } from "./navigation";
import { ListRow } from "./Page";
import { Chrome } from "./Type";

/**
 * `Translation        BSB ›` at the top of Contents (MT-01; amendment 13:
 * switching translation lives here). One value row, Apple Settings' pattern:
 * four segments was the most that fitted, and downloads would break them.
 *
 * CT-01 draws ⋯ beside the old BSB/WEB/KJV segment; MT-01 replaced the segment with this row, so ⋯ sits beside the
 * row instead, on the books and on a book's chapters alike.
 */
export function TranslationValueRow() {
  const translation = useSettings((s) => s.translation);
  const name = useTranslationName(translation);
  return (
    <View style={styles.top}>
      <View style={{ flex: 1 }}>
        <ListRow
          first
          title={<Chrome tone="ink" style={{ fontWeight: "500" }}>Translation</Chrome>}
          right={
            <Chrome tone="muted" testID="contents-translation-value">
              {translation}
            </Chrome>
          }
          label={`Translation, ${name}`}
          onPress={() => router.push("/translations")}
          testID="contents-translation"
        />
      </View>
      <ContentsMore />
    </View>
  );
}

/** CT-01: Contents › ⋯ — Recent, Book order and Choose a verse, each showing its setting. */
function ContentsMore() {
  const palette = usePalette();
  const { control } = useLayout();
  const { closeSheet } = useSheetNav();
  const bookOrder = useSettings((s) => s.bookOrder);
  const chooseVerse = useSettings((s) => s.chooseVerse);
  const orderName = bookOrder === "az" ? "A to Z" : "Traditional";
  return (
    <MenuView
      shouldOpenOnLongPress={false}
      actions={[
        // imageColor always set: without it @react-native-menu draws the glyph transparent (index.tsx, 10 Oct 2026).
        { id: "recent", title: "Recent", image: "clock", imageColor: palette.ink },
        {
          id: "order",
          title: "Book order",
          subtitle: orderName,
          image: "list.bullet",
          imageColor: palette.ink,
          subactions: [
            { id: "order-traditional", title: "Traditional", state: bookOrder === "traditional" ? "on" : "off" },
            { id: "order-az", title: "A to Z", state: bookOrder === "az" ? "on" : "off" },
          ],
        },
        { id: "verse", title: "Choose a verse", subtitle: chooseVerse ? "On" : "Off", image: "number", imageColor: palette.ink, state: chooseVerse ? "on" : "off" },
      ]}
      onPressAction={({ nativeEvent }) => {
        const settings = useSettings.getState();
        switch (nativeEvent.event) {
          case "recent":
            // Recent is a page: Contents closes first, as picking a chapter does, so the page is not drawn in the sheet.
            closeSheet();
            router.push("/recent");
            return;
          case "order-traditional":
            return settings.setBookOrder("traditional");
          case "order-az":
            return settings.setBookOrder("az");
          case "verse":
            return settings.setChooseVerse(!settings.chooseVerse);
        }
      }}
      testID="contents-more"
    >
      {/* The menu is a UIButton; a child that took the touch would keep it from opening. */}
      <View
        pointerEvents="none"
        accessible
        accessibilityRole="button"
        accessibilityLabel={`More: Recent, Book order ${orderName}, Choose a verse ${chooseVerse ? "on" : "off"}`}
        // White circle with a hairline ring, as the sheet's own round controls (polish-2026-10-15.md).
        style={[styles.round, { width: control, height: control, backgroundColor: palette.sheet, borderColor: palette.edge }]}
      >
        <Icon name="more" size={20} />
      </View>
    </MenuView>
  );
}

/** C-02's grid, for chapters and (CT-03) a chapter's verses: 5 columns, 3 at AX sizes; the current one in ink. */
export function NumberGrid({
  numbers,
  current,
  onPick,
  label,
  testID,
}: {
  numbers: readonly number[];
  current: number | null;
  onPick: (n: number) => void;
  label: (n: number) => string;
  testID: (n: number) => string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  const columns = ax ? 3 : 5;
  return (
    <View style={styles.grid}>
      {numbers.map((n) => {
        const on = n === current;
        return (
          <Pressable
            key={n}
            onPress={() => onPick(n)}
            accessibilityRole="button"
            accessibilityLabel={`${label(n)}${on ? ", reading" : ""}`}
            accessibilityState={{ selected: on }}
            testID={testID(n)}
            style={({ pressed }) => [
              styles.cell,
              { width: `${100 / columns - 2}%`, height: ax ? 96 : 56, backgroundColor: on ? palette.ink : palette.fill },
              pressed && !on ? { opacity: 0.6 } : null,
            ]}
          >
            <Chrome tone={on ? "paper" : "ink"} style={{ fontFamily: "Literata", fontSize: 20, fontWeight: on ? "600" : "400" }} maxFontSizeMultiplier={1.7}>
              {n}
            </Chrome>
          </Pressable>
        );
      })}
    </View>
  );
}

interface StackLike {
  getParent(): StackLike | undefined;
  getState(): { key: string } | undefined;
  dispatch(action: { type: string; payload?: unknown; target?: string }): void;
}

/**
 * Close Contents and read: in the reader it replaces the chapter, from Home it opens one. A verse (CT-03) opens the
 * reader at it, selected, as Search's Go to does.
 */
export function usePickChapter(from: string | undefined) {
  const navigation = useNavigation() as unknown as StackLike;
  return (book: BookCode, chapter: number, verse?: number) => {
    const host = navigation.getParent();
    const key = host?.getState()?.key;
    if (host !== undefined && key !== undefined) host.dispatch({ type: "POP", payload: { count: 1 }, target: key });
    const href = readerHref(verse === undefined ? { book, chapter } : { book, chapter, verse, select: true });
    if (from === "home") router.push(href);
    // Jumps land instantly (brief §5); the reader resets its scroll on a new chapter.
    else router.navigate(href);
  };
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    marginBottom: 28,
  },
  round: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: "2.5%",
    rowGap: 8,
  },
  cell: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * Typography-led verse rows for Bookmarks and Recently explored: a small
 * tracked reference, then the verse in scripture type. No cards, no
 * thumbnails — Medium's reading-list rows
 * (https://mobbin.com/screens/d029d138-2f1e-4517-be89-1e6a85390df6).
 */

import { formatDisplayRef, parseVerseId, verseOrd } from "@yada/schema";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useCore, useQuery } from "../data/AppData";
import { getTextsForOrds } from "../data/queries";
import { SPACE, usePalette } from "../design/tokens";
import { useSettings } from "../state/settings";
import { readerHref } from "./navigation";
import { Label, Prose, Scripture } from "./Type";

export interface VerseListItem {
  readonly verseId: string;
  /** A second small label, e.g. "Understand" for what was explored. */
  readonly note?: string;
}

export function VerseList({
  items,
  empty,
  onLongPress,
}: {
  items: readonly VerseListItem[];
  empty: string;
  onLongPress?: (verseId: string) => void;
}) {
  const palette = usePalette();
  const core = useCore();
  const translation = useSettings((s) => s.translation);
  const refs = items.map((item) => ({ item, ref: parseVerseId(item.verseId) }));
  const ords = refs.flatMap(({ ref }) => (ref === null ? [] : [verseOrd(ref.book, ref.chapter, ref.verse)]));
  const { data: texts } = useQuery(() => getTextsForOrds(core, ords, translation), [ords.join(","), translation]);

  if (items.length === 0) {
    return (
      <Prose tone="muted" style={{ marginTop: SPACE.md }}>
        {empty}
      </Prose>
    );
  }

  return (
    <View>
      {refs.map(({ item, ref }) => {
        if (ref === null) return null;
        const ord = verseOrd(ref.book, ref.chapter, ref.verse);
        return (
          <Pressable
            key={item.verseId}
            onPress={() => router.push(readerHref({ book: ref.book, chapter: ref.chapter, verse: ref.verse, select: true }))}
            onLongPress={onLongPress === undefined ? undefined : () => onLongPress(item.verseId)}
            style={({ pressed }) => [styles.row, { borderTopColor: palette.divider }, pressed ? { backgroundColor: palette.selection } : null]}
            accessibilityRole="link"
            accessibilityHint={onLongPress === undefined ? undefined : "Long press for more"}
            testID={`verse-row-${item.verseId}`}
          >
            <View style={styles.head}>
              <Label tone="ink" accessibilityRole="text">
                {formatDisplayRef(ref)}
              </Label>
              {item.note !== undefined ? <Label>{item.note}</Label> : null}
            </View>
            <Scripture step="explanation" numberOfLines={3} style={{ marginTop: SPACE.xs }}>
              {texts?.get(ord) ?? ""}
            </Scripture>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.md,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: SPACE.md,
  },
});

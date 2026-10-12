/**
 * Bookmarks (canvas B-01, B-02): the verses the reader kept, newest first, as
 * Medium's reading-list rows (https://mobbin.com/screens/d029d138-2f1e-4517-be89-1e6a85390df6).
 *
 * Removal is `Edit` in the header, as iOS lists do, plus a VoiceOver custom
 * action on each row (brief §5 Gestures): a hidden long press had no visible
 * or spoken equivalent.
 *
 * One muted line after the rows says where they are kept (canvas IC-01): the
 * reader would otherwise assume a reinstall loses them. It is one sentence,
 * true signed in or out, because no reliable signed-in signal exists for the
 * key-value store (data/cloud.ts cloudAvailable), so IC-02's signed-out line
 * is not drawn. Nothing else in the app mentions iCloud.
 */

import { parseVerseId, type VerseRef, verseOrd } from "@yada/schema";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { type AccessibilityActionEvent, Pressable, StyleSheet, View } from "react-native";

import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { GlassText, ListRow, PageScreen } from "../components/Page";
import { Chrome, Scripture } from "../components/Type";
import { DivineText } from "../components/Verse";
import { useAppData, useCore, useQuery } from "../data/AppData";
import { cloudAvailable } from "../data/cloud";
import { getTextsForOrds } from "../data/queries";
import { listBookmarks, removeBookmark } from "../data/user";
import { useLayout, usePalette } from "../design/tokens";
import { excerptOf } from "../lib/reader";
import { verseLabel } from "../lib/saved";
import { useSettings } from "../state/settings";

export default function BookmarksScreen() {
  const palette = usePalette();
  const core = useCore();
  const { user } = useAppData();
  const { ax, control } = useLayout();
  const translation = useSettings((s) => s.translation);
  const [ids, setIds] = useState<string[] | null>(null);
  const [editing, setEditing] = useState(false);
  const reload = useCallback(() => {
    void listBookmarks(user).then((rows) => setIds(rows.map((r) => r.verse_id)));
  }, [user]);
  useFocusEffect(reload);

  const refs = (ids ?? []).flatMap((id) => {
    const ref = parseVerseId(id);
    return ref === null ? [] : [{ id, ref, ord: verseOrd(ref.book, ref.chapter, ref.verse) }];
  });
  const ords = refs.map((r) => r.ord);
  const { data: texts } = useQuery(() => getTextsForOrds(core, ords, translation), [ords.join(","), translation]);

  const remove = (id: string) => {
    void removeBookmark(user, id).then(reload);
  };
  const open = (ref: VerseRef) => router.push(readerHref({ book: ref.book, chapter: ref.chapter, verse: ref.verse, select: true }));
  const empty = ids !== null && refs.length === 0;

  return (
    <PageScreen
      title="Bookmarks"
      testID="bookmarks"
      right={
        empty || ids === null ? null : (
          <GlassText label={editing ? "Done" : "Edit"} onPress={() => setEditing((e) => !e)} testID="bookmarks-edit" />
        )
      }
    >
      {empty ? (
        <View>
          <Chrome tone="ink" style={styles.empty} maxFontSizeMultiplier={2.2}>
            No bookmarks yet.
          </Chrome>
          <Chrome step="note" tone="muted">
            Tap a verse, then ⋯ › Bookmark.
          </Chrome>
        </View>
      ) : null}
      {refs.map(({ id, ref, ord }, i) => {
        const label = verseLabel(ref);
        const excerpt = excerptOf(texts?.get(ord) ?? "");
        return (
          // One element to VoiceOver with the remove action on it; touches still reach the row and its control.
          <View
            key={id}
            // Maestro sees this element, not the row inside it.
            testID={`bookmark-${id}`}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${label}. ${excerpt}`}
            accessibilityActions={[{ name: "activate" }, { name: "remove", label: "Remove bookmark" }]}
            onAccessibilityAction={(e: AccessibilityActionEvent) => (e.nativeEvent.actionName === "remove" ? remove(id) : open(ref))}
          >
            <ListRow
              first={i === 0}
              overline={label}
              onPress={editing ? undefined : () => open(ref)}
              chevron={false}
              right={
                editing ? (
                  <Pressable
                    onPress={() => remove(id)}
                    style={({ pressed }) => [
                      styles.remove,
                      { width: control, height: control, backgroundColor: pressed ? palette.selection : palette.fill },
                    ]}
                  >
                    <Icon name="close" size={16} />
                  </Pressable>
                ) : undefined
              }
            >
              <Scripture step="claim" numberOfLines={ax ? 3 : 2} style={{ fontFamily: "Literata" }}>
                <DivineText text={excerpt} translation={translation} />
              </Scripture>
            </ListRow>
          </View>
        );
      })}
      {refs.length > 0 && cloudAvailable() ? (
        <Chrome step="note" tone="muted" style={styles.kept} testID="bookmarks-icloud">
          Bookmarks and your reading place are kept in iCloud when you’re signed in.
        </Chrome>
      ) : null}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: "Literata",
    fontSize: 22,
    lineHeight: 29,
    marginBottom: 6,
  },
  kept: {
    marginTop: 20,
  },
  remove: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});

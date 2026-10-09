/**
 * Bookmarks: the verses the reader kept, newest first. Long press to remove —
 * a quiet action for a quiet list, and nothing destructive on a plain tap.
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS, ScrollView, View } from "react-native";

import { PageHeader } from "../components/PageHeader";
import { VerseList } from "../components/VerseList";
import { useAppData } from "../data/AppData";
import { listBookmarks, removeBookmark } from "../data/user";
import { SPACE, usePalette } from "../design/tokens";

export default function BookmarksScreen() {
  const palette = usePalette();
  const { user } = useAppData();
  const [ids, setIds] = useState<string[]>([]);

  const reload = useCallback(() => {
    void listBookmarks(user).then((rows) => setIds(rows.map((r) => r.verse_id)));
  }, [user]);
  useFocusEffect(reload);

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <PageHeader title="Bookmarks" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxl }}>
        <VerseList
          items={ids.map((verseId) => ({ verseId }))}
          empty="Nothing bookmarked yet. Select a verse while reading, then ⋯ › Bookmark."
          onLongPress={(verseId) =>
            ActionSheetIOS.showActionSheetWithOptions(
              { options: ["Remove bookmark", "Cancel"], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
              (index) => {
                if (index === 0) void removeBookmark(user, verseId).then(reload);
              },
            )
          }
        />
      </ScrollView>
    </View>
  );
}

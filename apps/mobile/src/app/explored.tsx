/**
 * Recently explored (PRD §8.6): the verses the reader looked underneath,
 * newest first, from the local event log. Nothing here leaves the device.
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";

import { PageHeader } from "../components/PageHeader";
import { VerseList, type VerseListItem } from "../components/VerseList";
import { useAppData } from "../data/AppData";
import { type EventName, recentlyExplored } from "../data/user";
import { SPACE, usePalette } from "../design/tokens";

const WHAT: Partial<Record<EventName, string>> = {
  understand_open: "Understand",
  passage_open: "Passage",
  word_open: "A word",
  claim_open: "Why",
};

export default function ExploredScreen() {
  const palette = usePalette();
  const { user } = useAppData();
  const [items, setItems] = useState<VerseListItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      void recentlyExplored(user).then((rows) =>
        setItems(rows.map((r) => ({ verseId: r.verse_id, note: WHAT[r.name] }))),
      );
    }, [user]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }}>
      <PageHeader title="Recently explored" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxl }}>
        <VerseList items={items} empty="Verses you look underneath — Understand, Original, a word — appear here." />
      </ScrollView>
    </View>
  );
}

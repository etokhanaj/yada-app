/**
 * Your list (FL-05, PT-46; John, 24 Oct 2026): the prayers only you see, with Add, each item's ⋯ Mark answered, Edit,
 * Remove with Undo (PC-10, PC-11), answered ones kept below with their date. It was a section of Pray until Pray became
 * a tab of ways to pray; People now opens it.
 */

import { MenuView } from "@react-native-menu/menu";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";

import { Icon } from "../../../components/Icon";
import { PageScreen } from "../../../components/Page";
import { Toast } from "../../../components/Toast";
import { Chrome, Prose, SectionTitle } from "../../../components/Type";
import { useAppData } from "../../../data/AppData";
import {
  loadPrayLocal,
  markListAnswered,
  removeFromList,
  restoreListItem,
} from "../../../data/prayLocal";
import { usePalette } from "../../../design/tokens";
import { type ListItem, listItemLine } from "../../../lib/pray";

export default function YourList() {
  const { user } = useAppData();
  const palette = usePalette();
  const [list, setList] = useState<ListItem[]>([]);
  const [removed, setRemoved] = useState<{
    index: number;
    item: ListItem;
  } | null>(null);
  const reload = useCallback(() => {
    void loadPrayLocal(user)
      .then((local) => setList(local.list))
      .catch(() =>
        AccessibilityInfo.announceForAccessibility(
          "Couldn’t open your list. Try again.",
        ),
      );
  }, [user]);
  useFocusEffect(reload);

  const failed = () =>
    AccessibilityInfo.announceForAccessibility(
      "Couldn’t change your list. Try again.",
    );
  const add = () => router.push("/pray/add");
  const act = (i: number, item: ListItem, action: string) => {
    if (action === "answered")
      void markListAnswered(user, i).then(reload).catch(failed);
    if (action === "edit")
      router.push({
        pathname: "/pray/add",
        params: { index: String(i), text: item.text },
      });
    if (action === "remove")
      void removeFromList(user, i)
        .then(() => setRemoved({ index: i, item }))
        .then(reload)
        .catch(failed);
  };

  const indexed = list.map((item, i) => ({ item, i }));
  const open = indexed.filter(({ item }) => item.answered === undefined);
  const answered = indexed.filter(({ item }) => item.answered !== undefined);
  const row = ({ item, i }: { item: ListItem; i: number }, first: boolean) => {
    const line = listItemLine(item);
    const actions = [
      ...(item.answered === undefined
        ? [{ id: "answered", title: "Mark answered" }]
        : []),
      { id: "edit", title: "Edit" },
      { id: "remove", title: "Remove" },
    ];
    return (
      <View
        key={`${i}-${item.text}`}
        style={[
          styles.item,
          first
            ? null
            : {
                borderTopColor: palette.divider,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
        ]}
        testID={`pray-item-${i}`}
      >
        <View
          style={[
            styles.dot,
            item.answered !== undefined
              ? { backgroundColor: palette.accent }
              : { borderColor: palette.mutedInk, borderWidth: 1.5 },
          ]}
        />
        <View
          style={{ flex: 1 }}
          accessible
          accessibilityLabel={
            line === null ? item.text : `${item.text}. ${line}`
          }
          accessibilityActions={actions.map((a) => ({
            name: a.id,
            label: a.title,
          }))}
          onAccessibilityAction={(e) => act(i, item, e.nativeEvent.actionName)}
        >
          <Prose>{item.text}</Prose>
          {line !== null ? (
            <Chrome step="note" tone="muted" style={{ marginTop: 3 }}>
              {line}
            </Chrome>
          ) : null}
        </View>
        {/* VoiceOver reaches the choices as the item's actions, so the menu itself is hidden from it. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MenuView
            shouldOpenOnLongPress={false}
            actions={actions.map((a) => ({ id: a.id, title: a.title }))}
            onPressAction={({ nativeEvent }) => act(i, item, nativeEvent.event)}
          >
            <View style={styles.more}>
              <Icon name="more" size={20} tone="muted" />
            </View>
          </MenuView>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <PageScreen
        title="Your list"
        back="Pray"
        subtitle="Only you see it"
        clearTabBar
        testID="pray-list"
        right={
          <Pressable
            onPress={add}
            accessibilityRole="button"
            accessibilityLabel="Add to your list"
            hitSlop={8}
            style={styles.addLink}
            testID="pray-add-row"
          >
            <Icon name="plus" size={18} tone="accent" />
            <Chrome tone="accent" style={{ fontWeight: "600" }}>
              Add
            </Chrome>
          </Pressable>
        }
      >
        {open.length === 0 ? (
          <Prose style={{ marginTop: 4 }}>
            Who would you like to pray for?
          </Prose>
        ) : (
          open.map((x, n) => row(x, n === 0))
        )}
        {answered.length > 0 ? (
          <View style={{ marginTop: 28 }}>
            <SectionTitle style={{ marginBottom: 4 }}>Answered</SectionTitle>
            {answered.map((x, n) => row(x, n === 0))}
          </View>
        ) : null}
      </PageScreen>
      {removed !== null ? (
        <Toast
          text="Removed from your list"
          action="Undo"
          onAction={() => {
            const r = removed;
            setRemoved(null);
            void restoreListItem(user, r.index, r.item)
              .then(reload)
              .catch(failed);
          }}
          onDone={() => setRemoved(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  addLink: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 14,
    paddingVertical: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 11 },
  more: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
    marginRight: -12,
  },
});

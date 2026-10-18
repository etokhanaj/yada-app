/**
 * Pray (PR-07, CI-01): your private list first, each item with the day it was added or answered and one line saying
 * only you see it; then Pray for someone, asking and your requests; Prayers of the Bible once John has approved its
 * list (PR-08); then Circles. The list stays on this iPhone (it is not a synced setting); only what you ask for is posted.
 * Without CloudKit (signed out, or an older build) the list still works (XT-05). Circles (CI-01) are people you know,
 * by invitation; New circle names one and opens it, and without iCloud it explains why one is needed (CI-03).
 * Add is the + in the header (PR-07); with nothing on the list yet, a row offers it too, so the section is never bare.
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Alert, View } from "react-native";

import { type Circle, circlesCloud, prayCloud } from "../../../../../modules/yada-pray";
import { Icon } from "../../../../components/Icon";
import { GlassIcon, ListRow, PageScreen } from "../../../../components/Page";
import { Chrome, SectionTitle } from "../../../../components/Type";
import { useAppData } from "../../../../data/AppData";
import { addToList, loadPrayLocal, markListAnswered, removeFromList } from "../../../../data/prayLocal";
import { PRAYERS_OF_THE_BIBLE } from "../../../../data/prayersOfTheBible";
import { useLayout } from "../../../../design/tokens";
import { type ListItem, listItemLine, peopleLine } from "../../../../lib/pray";

export default function Pray() {
  const { user } = useAppData();
  const { sectionGap } = useLayout();
  const [list, setList] = useState<ListItem[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const reload = useCallback(() => {
    void loadPrayLocal(user).then((l) => setList(l.list));
    if (circlesCloud === null) return;
    void circlesCloud
      .list()
      .then(async (all) => {
        setCircles(all);
        // An invitation accepted while Yada opened goes straight to that circle.
        const accepted = (await circlesCloud?.takeAccepted()) ?? [];
        const joined = all.find((c) => accepted.includes(c.id));
        if (joined !== undefined) openCircle(joined);
      })
      .catch(() => setCircles([]));
  }, [user]);
  useFocusEffect(reload);

  const openCircle = (c: Circle) => router.push({ pathname: "/today/pray/circle", params: { id: c.id, owner: c.owner, name: c.name, owned: c.owned ? "1" : "", people: String(c.people) } });
  const newCircle = async () => {
    if ((await prayCloud?.accountStatus().catch(() => null)) !== "available") return router.push("/pray/icloud");
    Alert.prompt("New circle", "A name the people in it will see", (text) => {
      const name = text.trim();
      if (name !== "" && circlesCloud !== null) void circlesCloud.create(name).then((id) => openCircle({ id, owner: "", owned: true, name, people: 1 }));
    });
  };

  // A failed write to the list said nothing (code review, 18 Oct 2026).
  const failed = () => AccessibilityInfo.announceForAccessibility("Couldn’t change your list. Try again.");
  const add = () =>
    Alert.prompt("Add to your list", undefined, (text) => {
      const item = text.trim();
      if (item !== "") void addToList(user, item).then(reload).catch(failed);
    });
  // Answered keeps the item with its date (PR-07, "Answered 12 Oct"); Remove takes it off.
  const act = (i: number, item: ListItem) => {
    const choices: [string, () => Promise<void>][] = [
      ...(item.answered === undefined ? [["Mark answered", () => markListAnswered(user, i)] as [string, () => Promise<void>]] : []),
      ["Remove from your list", () => removeFromList(user, i)],
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: item.text, options: [...choices.map(([t]) => t), "Cancel"], destructiveButtonIndex: choices.length - 1, cancelButtonIndex: choices.length },
      (n) => void choices[n]?.[1]().then(reload).catch(failed),
    );
  };

  return (
    <PageScreen title="Pray" back="Today" right={<GlassIcon icon="plus" label="Add to your list" onPress={add} testID="pray-add" />} clearTabBar testID="pray">
      <SectionTitle style={{ marginBottom: 6 }}>Your list</SectionTitle>
      {list.map((item, i) => {
        const line = listItemLine(item);
        return (
          <ListRow
            key={`${i}-${item.text}`}
            first={i === 0}
            title={item.text}
            subtitle={line ?? undefined}
            onPress={() => act(i, item)}
            label={line === null ? item.text : `${item.text}. ${line}`}
            testID={`pray-item-${i}`}
          />
        );
      })}
      {list.length === 0 ? <ListRow first title="Add to your list" onPress={add} testID="pray-add-row" /> : null}
      {/* PR-07: who sees the list, said once under it (design system, Words). */}
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 6, marginTop: 10 }}>
        <Icon name="lock" size={13} tone="muted" />
        <Chrome step="note" tone="muted">
          Only you see your list.
        </Chrome>
      </View>

      {prayCloud !== null ? (
        <>
          <SectionTitle style={{ marginTop: sectionGap, marginBottom: 6 }}>For each other</SectionTitle>
          <ListRow first title="Pray for someone" onPress={() => router.push("/pray/someone")} testID="pray-someone" />
          <ListRow title="Ask for prayer" onPress={() => router.push("/pray/ask")} testID="pray-ask" />
          <ListRow title="Your requests" onPress={() => router.push("/today/pray/mine")} testID="pray-mine" />
        </>
      ) : null}

      {/* PR-08: hidden until John approves the list it reads (data/prayersOfTheBible.ts ships empty). */}
      {PRAYERS_OF_THE_BIBLE.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <ListRow first title="Prayers of the Bible" subtitle="Prayers in Scripture, to pray with" onPress={() => router.push("/today/pray/bible")} testID="pray-bible-row" />
        </View>
      ) : null}

      {circlesCloud !== null ? (
        <>
          <SectionTitle style={{ marginTop: sectionGap, marginBottom: 6 }}>Circles</SectionTitle>
          {circles.map((c, i) => (
            <ListRow key={c.id} first={i === 0} title={c.name} subtitle={peopleLine(c.people)} onPress={() => openCircle(c)} />
          ))}
          <ListRow first={circles.length === 0} title="New circle" onPress={() => void newCircle()} testID="pray-new-circle" />
        </>
      ) : null}
    </PageScreen>
  );
}

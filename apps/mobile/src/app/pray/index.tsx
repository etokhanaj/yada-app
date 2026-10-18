/**
 * Pray (PR-07): your private list first, then Pray for someone, asking, and your requests. The list stays on this
 * iPhone and in your iCloud; only what you ask for is posted. Without CloudKit (signed out, or an older build) the
 * list still works (XT-05). Circles follow (CI-01): people you know, by invitation; New circle names one and opens it,
 * and without iCloud it explains why one is needed (CI-03).
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { type Circle, circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { ListRow, PageScreen } from "../../components/Page";
import { Label } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { addToList, loadPrayLocal, removeFromList } from "../../data/prayLocal";
import { useLayout } from "../../design/tokens";
import { peopleLine } from "../../lib/pray";

export default function Pray() {
  const { user } = useAppData();
  const { sectionGap } = useLayout();
  const [list, setList] = useState<string[]>([]);
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

  const openCircle = (c: Circle) => router.push({ pathname: "/pray/circle", params: { id: c.id, owner: c.owner, name: c.name, owned: c.owned ? "1" : "", people: String(c.people) } });
  const newCircle = async () => {
    if ((await prayCloud?.accountStatus().catch(() => null)) !== "available") return router.push("/pray/icloud");
    Alert.prompt("New circle", "A name the people in it will see", (text) => {
      const name = text.trim();
      if (name !== "" && circlesCloud !== null) void circlesCloud.create(name).then((id) => openCircle({ id, owner: "", owned: true, name, people: 1 }));
    });
  };

  const add = () =>
    Alert.prompt("Add to your list", undefined, (text) => {
      const item = text.trim();
      if (item !== "") void addToList(user, item).then(reload);
    });
  const remove = (i: number, item: string) =>
    Alert.alert(item, undefined, [
      { text: "Remove from your list", style: "destructive", onPress: () => void removeFromList(user, i).then(reload) },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <PageScreen title="Pray" back="Today" testID="pray">
      <Label style={{ marginBottom: 6 }}>Your list</Label>
      {list.map((item, i) => (
        <ListRow key={`${i}-${item}`} first={i === 0} title={item} chevron={false} onPress={() => remove(i, item)} label={`${item}. Double tap to remove`} />
      ))}
      <ListRow first={list.length === 0} title="Add to your list" onPress={add} testID="pray-add" />

      {prayCloud !== null ? (
        <>
          <Label style={{ marginTop: sectionGap, marginBottom: 6 }}>For each other</Label>
          <ListRow first title="Pray for someone" subtitle="Hold to pray for a request" onPress={() => router.push("/pray/someone")} testID="pray-someone" />
          <ListRow title="Ask for prayer" onPress={() => router.push("/pray/ask")} testID="pray-ask" />
          <ListRow title="Your requests" onPress={() => router.push("/pray/mine")} testID="pray-mine" />
        </>
      ) : null}

      {circlesCloud !== null ? (
        <>
          <Label style={{ marginTop: sectionGap, marginBottom: 6 }}>Circles</Label>
          {circles.map((c, i) => (
            <ListRow key={c.id} first={i === 0} title={c.name} subtitle={peopleLine(c.people)} onPress={() => openCircle(c)} />
          ))}
          <ListRow first={circles.length === 0} title="New circle" onPress={() => void newCircle()} testID="pray-new-circle" />
        </>
      ) : null}
    </PageScreen>
  );
}

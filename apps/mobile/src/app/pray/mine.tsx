/**
 * Your requests (PR-11, XT-04): how many prayed, which only you see, and never "0 prayed"; ⋯ for Mark answered,
 * Renew and Delete. Answered keeps its date.
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS } from "react-native";

import { type PrayerRequest, prayCloud } from "../../../modules/yada-pray";
import { ListRow, PageScreen } from "../../components/Page";
import { Chrome } from "../../components/Type";
import { prayedLine, requestLine } from "../../lib/pray";

export default function Mine() {
  const [mine, setMine] = useState<PrayerRequest[] | null>(null);
  const reload = useCallback(() => void prayCloud?.mine().then(setMine).catch(() => setMine([])), []);
  useFocusEffect(reload);

  const act = (r: PrayerRequest) =>
    ActionSheetIOS.showActionSheetWithOptions({ options: ["Mark answered", "Renew for 7 days", "Delete", "Cancel"], destructiveButtonIndex: 2, cancelButtonIndex: 3 }, (i) => {
      const run = i === 0 ? prayCloud?.markAnswered(r.id) : i === 1 ? prayCloud?.renew(r.id) : i === 2 ? prayCloud?.remove(r.id) : undefined;
      if (run !== undefined) void run.then(reload);
    });

  const now = Date.now();
  return (
    <PageScreen title="Your requests" back="Pray" testID="pray-mine">
      {mine !== null && mine.length === 0 ? (
        <Chrome tone="muted">Nothing asked yet.</Chrome>
      ) : (
        (mine ?? []).map((r, i) => {
          const sub = [requestLine(r, now), prayedLine(r.prayed)].filter((x) => x !== null).join(" · ");
          return <ListRow key={r.id} first={i === 0} title={r.text} subtitle={sub} onPress={() => act(r)} label={`${r.text}. ${sub}. Double tap for Mark answered, Renew or Delete`} />;
        })
      )}
    </PageScreen>
  );
}

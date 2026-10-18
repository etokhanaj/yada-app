/**
 * A circle (CI-02): its requests, each with how many prayed but never who (build 8 plan §I.3); Ask this circle; Invite
 * for its creator, 12 at most (§I.4–5). One line says who sees them. ⋯ is Leave, or Delete for its creator (§I.7).
 * A request's own ⋯ is Prayed for this, Renew or Delete on yours, Report or Block on others' (§I.8, guideline 1.2).
 */

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActionSheetIOS, Pressable, View } from "react-native";

import { type CircleRequest, circlesCloud } from "../../../../../modules/yada-pray";
import { ListRow, PageScreen } from "../../../../components/Page";
import { Chrome } from "../../../../components/Type";
import { useAppData } from "../../../../data/AppData";
import { block, hide, loadPrayLocal } from "../../../../data/prayLocal";
import { useLayout } from "../../../../design/tokens";
import { inviteLine, offerable, prayedLine, requestLine } from "../../../../lib/pray";

export default function CirclePage() {
  const { id = "", owner = "", name = "Circle", owned = "", people = "1" } = useLocalSearchParams<{ id?: string; owner?: string; name?: string; owned?: string; people?: string }>();
  const { user } = useAppData();
  const { sectionGap } = useLayout();
  const [requests, setRequests] = useState<CircleRequest[] | null>(null);

  const reload = useCallback(() => {
    if (circlesCloud === null) return setRequests([]);
    void Promise.all([circlesCloud.requests(id, owner), loadPrayLocal(user)])
      // Hidden: the ones you reported. Unlike public requests, ones you prayed for stay, as the circle's shared list.
      .then(([all, local]) => setRequests(offerable(all, local.hidden, local.blocked)))
      .catch(() => setRequests([]));
  }, [id, owner, user]);
  useFocusEffect(reload);

  const act = (r: CircleRequest) => {
    const choices: [string, () => Promise<unknown> | undefined][] = r.mine
      ? [["Renew for 7 days", () => circlesCloud?.renew(id, owner, r.id)], ["Delete", () => circlesCloud?.remove(id, owner, r.id)]]
      : [
          ["Prayed for this", () => circlesCloud?.prayed(id, owner, r.id)],
          ["Report", () => Promise.all([circlesCloud?.report(id, owner, r.id), hide(user, r.id)])],
          ["Block this person", () => block(user, r.creator)],
        ];
    const options = [...choices.map(([title]) => title), "Cancel"];
    ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex: r.mine ? 1 : [1, 2], cancelButtonIndex: choices.length }, (i) => {
      void choices[i]?.[1]()?.then(reload);
    });
  };

  const options = () =>
    ActionSheetIOS.showActionSheetWithOptions({ options: [owned !== "" ? "Delete circle for everyone" : "Leave circle", "Cancel"], destructiveButtonIndex: 0, cancelButtonIndex: 1 }, (i) => {
      if (i === 0) void circlesCloud?.leave(id, owner).then(() => router.back());
    });

  const invite = owned !== "" ? inviteLine(Number(people)) : null;
  const now = Date.now();
  return (
    <PageScreen
      title={name}
      back="Pray"
      clearTabBar
      right={
        <Pressable onPress={options} accessibilityRole="button" accessibilityLabel={owned !== "" ? "Circle options: Delete" : "Circle options: Leave"} hitSlop={12}>
          <Chrome tone="ink">⋯</Chrome>
        </Pressable>
      }
      testID="circle"
    >
      {(requests ?? []).map((r, i) => {
        const sub = [requestLine(r, now), prayedLine(r.prayed)].filter((x) => x !== null).join(" · ");
        const by = r.firstName !== "" ? `${r.firstName}: ` : "";
        return <ListRow key={r.id} first={i === 0} title={`${by}${r.text}`} subtitle={sub} onPress={() => act(r)} label={`${by}${r.text}. ${sub}. Double tap for options`} />;
      })}
      <View style={{ marginTop: requests !== null && requests.length > 0 ? sectionGap : 0 }}>
        <ListRow first title="Ask this circle" onPress={() => router.push({ pathname: "/pray/ask", params: { circle: id, owner, name } })} testID="circle-ask" />
        {invite !== null ? <ListRow title="Invite" subtitle={invite} onPress={() => void circlesCloud?.invite(id).then(reload)} testID="circle-invite" /> : null}
      </View>
      <Chrome tone="muted" step="note" style={{ marginTop: 12 }}>
        Only people in {name} see these.
      </Chrome>
    </PageScreen>
  );
}

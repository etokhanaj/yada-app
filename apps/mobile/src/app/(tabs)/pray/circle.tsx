/**
 * A circle (PC-05, PC-06, PC-24; Build 11 canvas, approved 18 Oct 2026): it opens on its own tone with its name in
 * Literata and its twelve places; its requests in Literata, each with Pray (the hold screen, PC-20) and how many prayed,
 * never who (build 8 plan §I.3); Ask docked above the tabs. New and empty, the empty ring says what to do first; back from
 * inviting, a toast says the invite went (PC-24). ⋯ holds People and Rename, and Delete for its creator or Leave for
 * everyone else, each confirmed with what it does. A request's own ⋯ is Renew or Delete on yours, Report or Block on
 * others' (§I.8, App Store guideline 1.2). Refs: Insight Timer's group header, KOHO's open places.
 *
 * Pray together (11e): one lime button under the name starts it in FaceTime (PC-14, PC-15); while some of the circle
 * are praying together, who, and Ask to join. A planned time sits under the name with how many are coming this week,
 * I'll be there and Add to calendar (PC-18); its ⋯ changes the time, says you can't make it, or stops planning (PC-22).
 */

import { MenuView } from "@react-native-menu/menu";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type CircleLive, type CircleMember, type CircleRequest, circlesCloud, together } from "../../../../modules/yada-pray";
import { GlassButton } from "../../../components/Glass";
import { Icon } from "../../../components/Icon";
import { ListRow } from "../../../components/Page";
import { usePictureStatusBar } from "../../../components/PictureStatusBar";
import { Avatar } from "../../../components/pray/Avatar";
import { circleTone } from "../../../components/pray/CircleCover";
import { Places, Ring } from "../../../components/pray/Places";
import { useTabBarClearance } from "../../../components/TabBar";
import { Toast } from "../../../components/Toast";
import { Chrome, Prose } from "../../../components/Type";
import { useAppData } from "../../../data/AppData";
import { block, hide, loadPrayLocal } from "../../../data/prayLocal";
import { allowNotices, noticeGathering, startTogether, TOGETHER_SEEN, useTogether } from "../../../data/together";
import { loadSettings } from "../../../data/user";
import { BRAND, ON_PICTURE } from "../../../design/palette";
import { FONTS, useLayout, usePalette } from "../../../design/tokens";
import { CIRCLE_MAX, deleteCircleLine, inviteLine, offerable, prayedLine, requestLine } from "../../../lib/pray";
import { comingLine, liveLine, myAnswer, nextTime, onNow, planLine, weekKey } from "../../../lib/together";

/** iOS's own event sheet adds an event with no calendar access only from iOS 17; before that Add to calendar is left out. */
const CALENDAR_SHEET = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 17;

export default function CirclePage() {
  const params = useLocalSearchParams<{ id?: string; owner?: string; name?: string; owned?: string; people?: string; sent?: string }>();
  const { id = "", owner = "", owned = "", sent } = params;
  const [name, setName] = useState(params.name ?? "Circle");
  const { user } = useAppData();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { gutter, pill, ax } = useLayout();
  const clearance = useTabBarClearance();
  const [requests, setRequests] = useState<CircleRequest[] | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [toast, setToast] = useState(sent === "1");
  const [live, setLive] = useState<CircleLive>({ coming: [], together: [] });
  const [asked, setAsked] = useState(false);
  const inSession = useTogether((t) => t.session?.circle === id);
  const creator = owned !== "";

  const reload = useCallback(() => {
    if (circlesCloud === null) return setRequests([]);
    const empty: CircleLive = { coming: [], together: [] };
    void Promise.all([circlesCloud.requests(id, owner), loadPrayLocal(user), circlesCloud.members(id, owner).catch(() => []), circlesCloud.live(id, owner).catch(() => empty)])
      // Hidden: the ones you reported. Unlike public requests, ones you prayed for stay, as the circle's shared list.
      .then(([all, local, people, now]) => {
        setRequests(offerable(all, local.hidden, local.blocked));
        setMembers(people);
        setLive(now);
        const at = now.plan === undefined ? null : nextTime(now.plan, new Date());
        const week = weekKey(at ?? new Date());
        const going = now.coming.filter((c) => c.week === week && c.going).length;
        const planner = people.find((m) => m.id === now.plan?.by)?.name ?? "";
        void noticeGathering({ id, name }, now.plan, planner, myAnswer(now.coming, week) === true, going).catch(() => undefined);
      })
      .catch(() => setRequests([]));
  }, [id, owner, user, name]);
  useFocusEffect(reload);
  const { statusBar, onBandLayout, onScroll } = usePictureStatusBar();

  const failed = () => AccessibilityInfo.announceForAccessibility("Couldn’t reach the circle. Try again.");
  const joined = members.filter((m) => m.joined);
  const invited = members.filter((m) => !m.joined);
  const starter = members.find((m) => m.creator);
  const ask = () => router.push({ pathname: "/pray/ask", params: { circle: id, owner, name } });
  const invite = () => void circlesCloud?.invite(id).then(reload).catch(failed);
  const pray = (r: CircleRequest) => router.push({ pathname: "/pray/someone", params: { circle: id, owner, name, request: r.id } });

  // PC-06: each choice says what it does before it does it.
  const confirmLeave = () =>
    creator
      ? Alert.alert(`Delete ${name}?`, deleteCircleLine(joined.length), [
          { text: "Cancel", style: "cancel" },
          { text: "Delete for everyone", style: "destructive", onPress: () => void circlesCloud?.leave(id, owner).then(() => router.back()).catch(failed) },
        ])
      : Alert.alert(`Leave ${name}?`, `You stop seeing its requests, and yours in it are deleted. ${starter !== undefined && starter.name !== "" ? `${starter.name} can invite you again.` : "You can be invited again."}`, [
          { text: "Cancel", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => void circlesCloud?.leave(id, owner).then(() => router.back()).catch(failed) },
        ]);
  const rename = () =>
    Alert.prompt("Rename", "Everyone in the circle sees this name.", (text) => {
      const next = text.trim();
      if (next !== "" && circlesCloud !== null)
        void circlesCloud
          .rename(id, next)
          .then(() => setName(next))
          .catch(failed);
    }, "plain-text", name);
  const plan = live.plan;
  const planAt = plan === undefined ? null : nextTime(plan, new Date());
  const week = weekKey(planAt ?? new Date());
  const answer = myAnswer(live.coming, week);
  const nameOf = (m: string) => members.find((x) => x.id === m)?.name ?? "";
  const praying = onNow(live.together, Date.now());
  const planParams = plan === undefined ? {} : { weekday: String(plan.weekday), hour: String(plan.hour), minute: String(plan.minute), weekly: plan.weekly ? "1" : "0", minutes: String(plan.minutes) };
  const openPlan = () => router.push({ pathname: "/pray/plan", params: { id, owner, name, ...planParams } });
  const prayTogether = () => {
    if (inSession) return router.push("/pray/together");
    void loadSettings(user)
      .then((st) => (st[TOGETHER_SEEN] === "1" ? startTogether(id, name) : router.push({ pathname: "/pray/together-start", params: { id, owner, name } })))
      .catch(failed);
  };
  const come = (going: boolean) =>
    void circlesCloud
      ?.coming(id, owner, week, going)
      .then(() => (going ? allowNotices() : true))
      .then(reload)
      .catch(failed);
  const askToJoin = () =>
    void circlesCloud
      ?.together(id, owner, "ask")
      .then(() => setAsked(true))
      .catch(failed);
  const calendar = () => {
    if (plan === undefined || planAt === null) return;
    void together?.addToCalendar(`${name} prays together`, planAt.getTime(), plan.minutes, plan.weekly).catch(failed);
  };
  const planActions = plan === undefined ? [] : [
    ...(plan.mine ? [{ id: "change", title: "Change the time" }] : []),
    answer === false ? { id: "coming", title: "I’ll be there this week" } : { id: "cant", title: "Can’t make it this week" },
    ...(plan.mine ? [{ id: "stop", title: "Stop planning", attributes: { destructive: true } }] : []),
  ];
  const onPlan = (action: string) => {
    if (action === "change") openPlan();
    if (action === "coming") come(true);
    if (action === "cant") come(false);
    if (action === "stop")
      Alert.alert("Stop planning?", "The time goes for everyone in the circle, with who said they’d come.", [
        { text: "Cancel", style: "cancel" },
        { text: "Stop planning", style: "destructive", onPress: () => void circlesCloud?.unplan(id, owner).then(reload).catch(failed) },
      ]);
  };

  const options = [
    { id: "people", title: "People" },
    ...(together !== null && plan === undefined ? [{ id: "plan", title: "Plan a time to pray together" }] : []),
    ...(creator ? [{ id: "rename", title: "Rename" }] : []),
    { id: "leave", title: creator ? "Delete circle" : "Leave circle", attributes: { destructive: true } },
  ];
  const choose = (action: string) => {
    if (action === "people") router.push({ pathname: "/pray/people", params: { id, owner, name, owned } });
    if (action === "rename") rename();
    if (action === "plan") openPlan();
    if (action === "leave") confirmLeave();
  };

  const requestActions = (r: CircleRequest) =>
    r.mine
      ? [
          { id: "renew", title: "Renew for 7 days" },
          { id: "delete", title: "Delete", attributes: { destructive: true } },
        ]
      : [
          { id: "report", title: "Report", attributes: { destructive: true } },
          { id: "block", title: "Block this person", attributes: { destructive: true } },
        ];
  const onRequest = (r: CircleRequest, action: string) => {
    const run =
      action === "renew"
        ? circlesCloud?.renew(id, owner, r.id)
        : action === "delete"
          ? circlesCloud?.remove(id, owner, r.id)
          : action === "report"
            ? Promise.all([circlesCloud?.report(id, owner, r.id), hide(user, r.id)])
            : action === "block"
              ? block(user, r.creator)
              : undefined;
    void run?.then(reload).catch(failed);
  };

  const now = Date.now();
  const empty = requests !== null && requests.length === 0;
  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }} testID="circle">
      {statusBar}
      <ScrollView contentContainerStyle={{ paddingBottom: clearance + pill + 40 }} onScroll={onScroll} scrollEventThrottle={32}>
        <View onLayout={onBandLayout} style={[styles.band, { backgroundColor: circleTone(id), paddingTop: insets.top + 64, paddingHorizontal: gutter }]}>
          <Chrome accessibilityRole="header" style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", letterSpacing: -0.8 }} size={40}>
            {name}
          </Chrome>
          <View style={{ marginTop: 16 }}>
            <Places members={[...joined, ...invited]} />
          </View>
          <Chrome step="note" style={{ color: ON_PICTURE.muted, fontWeight: "600", marginTop: 10 }}>{`${joined.length} of ${CIRCLE_MAX} · invite only`}</Chrome>
          {together === null ? null : praying.length > 0 && !inSession ? (
            <View style={[styles.live, { backgroundColor: ON_PICTURE.glass }]} accessibilityLiveRegion="polite" testID="circle-live">
              <View style={styles.liveFaces}>
                {praying.slice(0, 3).map((m) => (
                  <Avatar key={m} id={m} name={nameOf(m)} size={26} onDark />
                ))}
              </View>
              <Chrome step="note" style={{ color: ON_PICTURE.text, flex: 1, fontWeight: "600" }}>
                {liveLine(praying.map(nameOf))}
              </Chrome>
              <Pressable onPress={askToJoin} disabled={asked} accessibilityRole="button" accessibilityState={{ disabled: asked }} style={[styles.small, { backgroundColor: BRAND.chartreuse, opacity: asked ? 0.6 : 1 }]} testID="circle-ask-join">
                <Chrome step="note" style={{ color: BRAND.ink, fontWeight: "700" }}>
                  {asked ? "Asked" : "Ask to join"}
                </Chrome>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={prayTogether} accessibilityRole="button" style={[styles.together, { minHeight: pill, backgroundColor: BRAND.chartreuse }]} testID="circle-together">
              <Icon name="phone" size={18} color={BRAND.ink} />
              <Chrome style={{ color: BRAND.ink, fontWeight: "700" }}>{inSession ? "Back to praying together" : "Pray together"}</Chrome>
            </Pressable>
          )}
          {together !== null && plan !== undefined && planAt !== null ? (
            <View style={[styles.plan, { backgroundColor: ON_PICTURE.glass }]} testID="circle-plan">
              <View style={styles.planHead}>
                <Chrome step="note" style={{ color: BRAND.chartreuse, fontWeight: "600", letterSpacing: 0.4 }}>
                  Praying together
                </Chrome>
                <MenuView shouldOpenOnLongPress={false} actions={planActions} onPressAction={({ nativeEvent }) => onPlan(nativeEvent.event)}>
                  <View style={styles.more} accessible accessibilityRole="button" accessibilityLabel="Planned time options">
                    <Icon name="more" size={18} color={ON_PICTURE.text} />
                  </View>
                </MenuView>
              </View>
              <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" }} size={22}>
                {planLine(plan, planAt)}
              </Chrome>
              <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
                {comingLine(live.coming, week, joined.length)}
              </Chrome>
              <View style={[styles.planButtons, ax ? { flexDirection: "column", alignItems: "stretch" } : null]}>
                <Pressable onPress={() => come(answer !== true)} accessibilityRole="button" accessibilityState={{ selected: answer === true }} style={[styles.small, styles.planButton, { backgroundColor: BRAND.chartreuse }]} testID="circle-coming">
                  {answer === true ? <Icon name="check" size={16} color={BRAND.ink} /> : null}
                  <Chrome step="note" style={{ color: BRAND.ink, fontWeight: "700" }}>
                    {answer === true ? "You’re coming" : "I’ll be there"}
                  </Chrome>
                </Pressable>
                {CALENDAR_SHEET ? (
                <Pressable onPress={calendar} accessibilityRole="button" style={[styles.small, styles.planButton, { backgroundColor: ON_PICTURE.glassSolid }]} testID="circle-calendar">
                  <Icon name="calendar" size={16} color={ON_PICTURE.text} />
                  <Chrome step="note" style={{ color: ON_PICTURE.text, fontWeight: "600" }}>
                    Add to calendar
                  </Chrome>
                </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: gutter }}>
          {empty ? (
            <View style={styles.empty}>
              <Ring members={joined} size={150} onDark={false} />
              <Prose step="scripture" style={{ textAlign: "center", marginTop: 8 }}>
                {invited.length > 0 ? `${invited.length} ${invited.length === 1 ? "person" : "people"} invited.` : "Nothing asked yet."}
              </Prose>
              <Chrome step="note" tone="muted" style={{ textAlign: "center", maxWidth: 280 }}>
                {invited.length > 0 ? "They appear here when they join. You can ask the first request now." : "Invite the people you pray with. Then ask the first request."}
              </Chrome>
            </View>
          ) : null}
          {(requests ?? []).map((r, i) => {
            const prayed = prayedLine(r.prayed);
            const meta = [r.firstName === "" ? null : r.firstName, requestLine(r, now), prayed].filter((x) => x !== null).join(" · ");
            return (
              <View key={r.id} style={[styles.request, i === 0 ? null : { borderTopColor: palette.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Prose>{r.text}</Prose>
                <View style={styles.meta}>
                  <Avatar id={r.creator} name={r.firstName} size={24} />
                  <Chrome step="note" tone="muted" style={{ flex: 1 }}>
                    {meta}
                  </Chrome>
                  {r.mine ? null : (
                    <Pressable onPress={() => pray(r)} accessibilityRole="button" accessibilityLabel={`Pray for this: ${r.text}`} style={[styles.pray, { backgroundColor: palette.selection }]}>
                      <Chrome tone="accent" style={{ fontWeight: "600" }} size={14}>
                        Pray
                      </Chrome>
                    </Pressable>
                  )}
                  <MenuView shouldOpenOnLongPress={false} actions={requestActions(r)} onPressAction={({ nativeEvent }) => onRequest(r, nativeEvent.event)}>
                    <View style={styles.more} accessible accessibilityRole="button" accessibilityLabel={r.mine ? "More: renew, delete" : "More: report, block"}>
                      <Icon name="more" size={18} tone="muted" />
                    </View>
                  </MenuView>
                </View>
              </View>
            );
          })}
          {creator && inviteLine(members.length) !== null ? (
            <View style={{ marginTop: 16 }}>
              <ListRow first title="Invite" subtitle={`${CIRCLE_MAX - members.length} more can join`} onPress={invite} testID="circle-invite" />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.top, { top: insets.top + 6, paddingHorizontal: 16 }]} pointerEvents="box-none">
        <GlassButton onPicture shape="capsule" onPress={() => router.back()} accessibilityLabel="Back to Pray">
          <View style={styles.backRow}>
            <Icon name="back" size={18} tone="white" />
            <Chrome style={{ color: ON_PICTURE.text }}>Pray</Chrome>
          </View>
        </GlassButton>
        <MenuView shouldOpenOnLongPress={false} actions={options} onPressAction={({ nativeEvent }) => choose(nativeEvent.event)}>
          <GlassButton onPicture accessibilityLabel={creator ? "Circle options: People, Rename, Delete" : "Circle options: People, Leave"} testID="circle-more">
            <Icon name="more" size={20} tone="white" />
          </GlassButton>
        </MenuView>
      </View>

      <View style={[styles.dock, { bottom: clearance - 12, left: gutter, right: gutter }]}>
        <Pressable onPress={empty && creator && invited.length === 0 ? invite : ask} accessibilityRole="button" style={[styles.dockPill, { minHeight: pill, backgroundColor: palette.ink }]} testID="circle-ask">
          <Chrome style={{ color: palette.paper, fontWeight: "600" }}>{empty && creator && invited.length === 0 ? `Invite to ${name}` : `Ask ${name}`}</Chrome>
        </Pressable>
      </View>
      {toast ? <Toast text="Invite sent" onDone={() => setToast(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingBottom: 24 },
  top: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", zIndex: 2 },
  backRow: { flexDirection: "row", alignItems: "center", columnGap: 4 },
  empty: { alignItems: "center", rowGap: 8, paddingTop: 28 },
  request: { paddingVertical: 18, rowGap: 12 },
  meta: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  pray: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center" },
  more: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  dock: { position: "absolute", zIndex: 3 },
  together: { flexDirection: "row", alignItems: "center", justifyContent: "center", columnGap: 8, borderRadius: 999, marginTop: 18 },
  live: { flexDirection: "row", alignItems: "center", columnGap: 10, borderRadius: 18, padding: 10, marginTop: 18 },
  liveFaces: { flexDirection: "row", columnGap: 2 },
  small: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  plan: { borderRadius: 20, padding: 16, rowGap: 6, marginTop: 14 },
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
  planButton: { flexDirection: "row", columnGap: 6, minHeight: 44 },
  dockPill: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
});

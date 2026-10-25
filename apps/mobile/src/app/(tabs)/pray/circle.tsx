/**
 * A circle (Build 12 PC-30, approved by John 25 Oct 2026; PC-05, PC-06, PC-24 before it). It opens on its own picture,
 * chosen when it was made, with its name in Literata and its people as faces, how many; Pray together as one pill
 * (or, while some are praying together, who and Ask to join); the planned time as a row whose menu says you'll come,
 * adds it to the calendar, changes it or stops it (PC-18, PC-22). Then its requests as raised cards (what people
 * wrote): who asked and when, the request in Literata, how many prayed, never who (build 8 plan §I.3), and Pray or
 * "You prayed". Ask docked, Invite beside it for the creator. ⋯ holds People, Plan a time and Rename, and Delete for
 * its creator or Leave for everyone else, each confirmed with what it does. A request's own ⋯ is Renew or Delete on
 * yours, Report or Block on others' (§I.8, App Store guideline 1.2). Refs: Insight Timer's group page
 * (mobbin.com/screens/7d180646-2db6-4e3c-b7a6-b1d0f26761ec).
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
import { Badge } from "../../../components/Badge";
import { FillPicture } from "../../../components/FillPicture";
import { Pill } from "../../../components/Pill";
import { Ring } from "../../../components/pray/Places";
import { RaisedCard } from "../../../components/RaisedCard";
import { useTabBarClearance } from "../../../components/TabBar";
import { Toast } from "../../../components/Toast";
import { Chrome, Prose, SectionTitle } from "../../../components/Type";
import { pictureFor } from "../../../data/pictures";
import { useAppData } from "../../../data/AppData";
import { block, hide, loadPrayLocal } from "../../../data/prayLocal";
import { allowNotices, noticeGathering, startTogether, TOGETHER_SEEN, useTogether } from "../../../data/together";
import { loadSettings } from "../../../data/user";
import { BRAND, ON_PICTURE } from "../../../design/palette";
import { FONTS, useLayout, usePalette } from "../../../design/tokens";
import { askedLine, circlePicture, deleteCircleLine, inviteLine, offerable, prayedLine, requestLine } from "../../../lib/pray";
import { comingLine, liveLine, myAnswer, nextTime, onNow, planLine, weekKey } from "../../../lib/together";

/** iOS's own event sheet adds an event with no calendar access only from iOS 17; before that Add to calendar is left out. */
const CALENDAR_SHEET = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 17;

export default function CirclePage() {
  const params = useLocalSearchParams<{ id?: string; owner?: string; name?: string; owned?: string; people?: string; sent?: string; picture?: string }>();
  const { id = "", owner = "", owned = "", sent } = params;
  const [name, setName] = useState(params.name ?? "Circle");
  const { user } = useAppData();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { gutter, pill, ax } = useLayout();
  const clearance = useTabBarClearance();
  const [requests, setRequests] = useState<CircleRequest[] | null>(null);
  const [prayedIds, setPrayedIds] = useState<ReadonlySet<string>>(new Set());
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
        setPrayedIds(local.prayed);
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
      .then((st) => (st[TOGETHER_SEEN] === "1" ? startTogether(id, name) : router.push({ pathname: "/pray/together-start", params: { id, owner, name, picture: params.picture ?? "" } })))
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
    answer === true ? { id: "cant", title: "Can’t make it this week" } : { id: "coming", title: "I’ll be there this week" },
    ...(CALENDAR_SHEET ? [{ id: "calendar", title: "Add to calendar" }] : []),
    ...(plan.mine ? [{ id: "change", title: "Change the time" }] : []),
    ...(plan.mine ? [{ id: "stop", title: "Stop planning", attributes: { destructive: true } }] : []),
  ];
  const onPlan = (action: string) => {
    if (action === "change") openPlan();
    if (action === "coming") come(true);
    if (action === "cant") come(false);
    if (action === "calendar") calendar();
    if (action === "stop")
      Alert.alert("Stop planning?", "The time goes for everyone in the circle, with who said they’d come.", [
        { text: "Cancel", style: "cancel" },
        { text: "Stop planning", style: "destructive", onPress: () => void circlesCloud?.unplan(id, owner).then(reload).catch(failed) },
      ]);
  };

  const options = [
    { id: "people", title: "People" },
    ...(together !== null && plan === undefined ? [{ id: "plan", title: "Plan a time to pray together" }] : []),
    ...(creator && inviteLine(members.length) !== null ? [{ id: "invite", title: "Invite" }] : []),
    ...(creator ? [{ id: "rename", title: "Rename" }] : []),
    { id: "leave", title: creator ? "Delete circle" : "Leave circle", attributes: { destructive: true } },
  ];
  const choose = (action: string) => {
    if (action === "people") router.push({ pathname: "/pray/people", params: { id, owner, name, owned } });
    if (action === "rename") rename();
    if (action === "plan") openPlan();
    if (action === "leave") confirmLeave();
    if (action === "invite") invite();
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
  const fresh = (requests ?? []).filter((r) => !r.mine && !prayedIds.has(r.id)).length;
  const cover = pictureFor(Number(params.picture) || circlePicture({ id }), "morning");
  const faces = [...joined, ...invited];
  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }} testID="circle">
      {statusBar}
      <ScrollView contentContainerStyle={{ paddingBottom: clearance + pill + 40 }} onScroll={onScroll} scrollEventThrottle={32}>
        <View onLayout={onBandLayout} style={[styles.band, { backgroundColor: BRAND.forest, paddingTop: insets.top + 64, paddingHorizontal: gutter }]}>
          {cover === undefined ? null : <FillPicture source={cover.image} />}
          <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: BAND_FADE }]} />
          <Chrome accessibilityRole="header" style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", letterSpacing: -0.6, marginTop: ax ? 24 : 40 }} size={34}>
            {name}
          </Chrome>
          <View style={styles.faces} accessible accessibilityLabel={`${joined.length} ${joined.length === 1 ? "person" : "people"}${invited.length > 0 ? `, ${invited.length} invited` : ""}`}>
            {faces.slice(0, ax ? 3 : 5).map((m, i) => (
              <View key={m.id} style={i === 0 ? null : { marginLeft: -8 }}>
                <Avatar id={m.id} name={m.name} size={30} onDark open={!m.joined} />
              </View>
            ))}
            <Chrome step="note" style={{ color: ON_PICTURE.strong, marginLeft: 10 }}>{`${joined.length} ${joined.length === 1 ? "person" : "people"}`}</Chrome>
          </View>
        </View>

        <View style={{ paddingHorizontal: gutter, paddingTop: 20 }}>
          {together === null ? null : praying.length > 0 && !inSession ? (
            <View style={[styles.live, { backgroundColor: palette.selection }]} accessibilityLiveRegion="polite" testID="circle-live">
              <View style={styles.liveFaces}>
                {praying.slice(0, 3).map((m) => (
                  <Avatar key={m} id={m} name={nameOf(m)} size={26} />
                ))}
              </View>
              <Chrome step="note" tone="ink" style={{ flex: 1, fontWeight: "600" }}>
                {liveLine(praying.map(nameOf))}
              </Chrome>
              <Pill small title={asked ? "Asked" : "Ask to join"} disabled={asked} onPress={askToJoin} testID="circle-ask-join" />
            </View>
          ) : (
            <Pill title={inSession ? "Back to praying together" : "Pray together"} icon="people" stretch onPress={prayTogether} testID="circle-together" />
          )}
          {together !== null && plan !== undefined && planAt !== null ? (
            <MenuView shouldOpenOnLongPress={false} actions={planActions} onPressAction={({ nativeEvent }) => onPlan(nativeEvent.event)}>
              <ListRow
                first
                leading={
                  <View style={[styles.bell, { backgroundColor: palette.fill }]}>
                    <Icon name="calendar" size={20} />
                  </View>
                }
                title={planLine(plan, planAt)}
                subtitle={answer === true ? `${comingLine(live.coming, week, joined.length)} · you too` : comingLine(live.coming, week, joined.length)}
                label={`${planLine(plan, planAt)}. ${comingLine(live.coming, week, joined.length)}. Options`}
                onPress={() => undefined}
                testID="circle-plan"
              />
            </MenuView>
          ) : null}

          {empty ? (
            <View style={styles.empty}>
              <Ring members={joined} size={150} onDark={false} />
              <Prose step="scripture" style={{ textAlign: "center", marginTop: 8 }}>
                {invited.length > 0 ? `${invited.length} ${invited.length === 1 ? "person" : "people"} invited.` : "Nothing asked yet."}
              </Prose>
            </View>
          ) : (
            <View style={styles.sectionHead}>
              <SectionTitle>Requests</SectionTitle>
              {fresh > 0 ? <Badge text={`${fresh} new`} /> : null}
            </View>
          )}
          {(requests ?? []).map((r) => {
            const asked = askedLine(r.firstName, r.createdAt, now);
            const prayed = prayedLine(r.prayed);
            const done = prayedIds.has(r.id);
            return (
              <RaisedCard key={r.id} testID={`circle-request-${r.id}`}>
                <View style={styles.meta}>
                  <Avatar id={r.creator} name={r.firstName} size={32} />
                  <Chrome step="note" tone="muted" style={{ flex: 1, fontWeight: "600" }}>
                    {r.mine ? `You · ${requestLine(r, now)}` : (asked ?? "")}
                  </Chrome>
                  <MenuView shouldOpenOnLongPress={false} actions={requestActions(r)} onPressAction={({ nativeEvent }) => onRequest(r, nativeEvent.event)}>
                    <View style={styles.more} accessible accessibilityRole="button" accessibilityLabel={r.mine ? "More: renew, delete" : "More: report, block"}>
                      <Icon name="more" size={18} tone="muted" />
                    </View>
                  </MenuView>
                </View>
                <Chrome tone="ink" style={styles.requestText} maxFontSizeMultiplier={2}>
                  {r.text}
                </Chrome>
                <View style={styles.foot}>
                  <Chrome step="note" tone="muted">
                    {prayed ?? ""}
                  </Chrome>
                  {r.mine ? null : done ? (
                    <View style={styles.prayed}>
                      <Icon name="check" size={14} tone="muted" />
                      <Chrome step="note" tone="muted">
                        You prayed
                      </Chrome>
                    </View>
                  ) : (
                    <Pill small title="Pray" label={`Pray for this: ${r.text}`} onPress={() => pray(r)} />
                  )}
                </View>
              </RaisedCard>
            );
          })}
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
          <GlassButton onPicture accessibilityLabel={creator ? "Circle options: People, Invite, Rename, Delete" : "Circle options: People, Leave"} testID="circle-more">
            <Icon name="more" size={20} tone="white" />
          </GlassButton>
        </MenuView>
      </View>

      <View style={[styles.dock, { bottom: clearance - 12, left: gutter, right: gutter }]}>
        {creator && inviteLine(members.length) !== null ? (
          <Pressable onPress={invite} accessibilityRole="button" accessibilityLabel={`Invite to ${name}`} style={[styles.dockSquare, { width: pill, height: pill, backgroundColor: palette.card }]} testID="circle-invite">
            <Icon name="plus" size={20} />
          </Pressable>
        ) : null}
        <Pressable onPress={empty && creator && invited.length === 0 ? invite : ask} accessibilityRole="button" style={[styles.dockPill, { minHeight: pill, backgroundColor: palette.ink }]} testID="circle-ask">
          <Chrome style={{ color: palette.paper, fontWeight: "600" }}>{empty && creator && invited.length === 0 ? `Invite to ${name}` : `Ask ${name}`}</Chrome>
        </Pressable>
      </View>
      {toast ? <Toast text="Invite sent" onDone={() => setToast(false)} /> : null}
    </View>
  );
}

/** Clear at the top for the picture, dark under the name and faces. */
const BAND_FADE = "linear-gradient(rgba(8,12,10,0.35), rgba(8,12,10,0.15) 40%, rgba(8,12,10,0.7))";

const styles = StyleSheet.create({
  band: { paddingBottom: 22, overflow: "hidden" },
  top: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", zIndex: 2 },
  backRow: { flexDirection: "row", alignItems: "center", columnGap: 4 },
  faces: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  empty: { alignItems: "center", rowGap: 8, paddingTop: 28 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 12 },
  meta: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  requestText: { fontFamily: FONTS.scripture, fontWeight: "400", fontSize: 21, lineHeight: 28, marginTop: 10, marginBottom: 8 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  prayed: { flexDirection: "row", alignItems: "center", columnGap: 4 },
  more: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  bell: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dock: { position: "absolute", zIndex: 3, flexDirection: "row", columnGap: 8 },
  dockSquare: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  dockPill: { flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  live: { flexDirection: "row", alignItems: "center", columnGap: 10, borderRadius: 18, padding: 10 },
  liveFaces: { flexDirection: "row", columnGap: 2 },
});

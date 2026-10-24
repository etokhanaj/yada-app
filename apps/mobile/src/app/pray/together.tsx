/**
 * Praying together (PC-16, PC-21, Build 11 canvas): on the circle's forest, who is here, the request large in Literata
 * on every screen, Next for everyone, and Leave. Someone asking to join shows as one line; FaceTime adds them.
 *
 * Departures from PC-16, because FaceTime carries the audio and tells no app about it: no Mute (FaceTime's own controls
 * mute), no ring round the one speaking, and Leave ends Pray together, not the call. PC-21's Add cannot open FaceTime's
 * add-people sheet (iOS has no way in), so the line says where to add them.
 *
 * No polling (CLAUDE.md): asks are read when this screen opens, when Yada comes back from FaceTime, and when the
 * number of phones in the session changes. The only timer is the on-screen clock, stopped when the screen closes.
 */

import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type CircleMember, type CircleRequest, circlesCloud, type TogetherMark } from "../../../modules/yada-pray";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/pray/Avatar";
import { Chrome } from "../../components/Type";
import { leaveTogether, step, useTogether } from "../../data/together";
import { BRAND, ON_PICTURE, SYSTEM } from "../../design/palette";
import { FONTS, useIsDark, useLayout } from "../../design/tokens";
import { onNow } from "../../lib/together";

export default function Together() {
  const session = useTogether((s) => s.session);
  const index = useTogether((s) => s.index);
  const here = useTogether((s) => s.here);
  const startedAt = useTogether((s) => s.startedAt);
  const people = useTogether((s) => s.people);
  const insets = useSafeAreaInsets();
  const { gutter, pill, ax } = useLayout();
  const dark = useIsDark();
  const [requests, setRequests] = useState<CircleRequest[] | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [asks, setAsks] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (session === null || circlesCloud === null) return;
    void circlesCloud.requests(session.circle, session.owner).then(setRequests).catch(() => setRequests([]));
    void circlesCloud.members(session.circle, session.owner).then(setMembers).catch(() => setMembers([]));
  }, [session]);
  const lookForAsks = useCallback(() => {
    if (session === null) return;
    void circlesCloud
      ?.live(session.circle, session.owner)
      .then((l) => setAsks(onNow(l.together.filter((m: TogetherMark) => m.at >= startedAt), Date.now(), "ask").filter((m) => !here.includes(m))))
      .catch(() => undefined);
  }, [session, startedAt, here]);
  useEffect(() => {
    lookForAsks();
    const back = AppState.addEventListener("change", (state) => state === "active" && lookForAsks());
    return () => back.remove();
  }, [lookForAsks, people]);
  useEffect(() => {
    const ticking = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticking);
  }, []);
  // The session ended elsewhere (FaceTime hung up, everyone left): back to the circle.
  useEffect(() => {
    if (session === null) router.back();
  }, [session]);

  if (session === null) return null;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "";
  const list = requests ?? [];
  const request = list[Math.min(index, list.length - 1)];
  const last = index >= list.length - 1;
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const faces = here.map((id) => members.find((m) => m.id === id) ?? { id, name: "", joined: true, creator: false, me: false });
  const asking = asks.map(nameOf).map((n) => (n === "" ? "Someone" : n));

  return (
    <View style={[styles.root, { backgroundColor: dark ? BRAND.forestCardDark : BRAND.forest }]} testID="together">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20, paddingHorizontal: gutter }}>
        <View style={styles.top}>
          <Chrome step="note" style={{ color: ON_PICTURE.muted, flex: 1 }}>
            <Chrome step="note" style={{ color: ON_PICTURE.text, fontWeight: "700" }}>
              {session.name}
            </Chrome>
            {" · praying together"}
          </Chrome>
          <Chrome step="note" style={{ color: ON_PICTURE.muted, fontVariant: ["tabular-nums"] }} accessibilityLabel={`${Math.floor(secs / 60)} minutes`}>
            {`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}
          </Chrome>
        </View>

        <View style={[styles.people, { flexWrap: "wrap" }]} accessible accessibilityLabel={`Here: ${faces.map((p) => (p.me ? "you" : p.name || "someone")).join(", ")}`}>
          {faces.map((p) => (
            <Avatar key={p.id} id={p.id} name={p.name} size={ax ? 64 : 56} onDark />
          ))}
        </View>

        {asking.length > 0 ? (
          <View style={[styles.ask, { backgroundColor: ON_PICTURE.glass }]} accessibilityLiveRegion="polite" testID="together-ask">
            <Avatar id={asks[0] ?? ""} name={asking[0] ?? ""} size={32} onDark />
            <View style={{ flex: 1 }}>
              <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>{`${asking.join(", ")} would like to join`}</Chrome>
              <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
                Add them from FaceTime’s controls.
              </Chrome>
            </View>
          </View>
        ) : null}

        <View style={styles.middle}>
          {request === undefined ? (
            requests === null ? null : (
              <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", textAlign: "center" }} size={26}>
                {`Nothing asked in ${session.name} yet.`}
              </Chrome>
            )
          ) : (
            <View style={{ rowGap: 12 }}>
              <Chrome step="note" style={{ color: BRAND.chartreuse, fontWeight: "600", letterSpacing: 0.4 }}>
                {last && list.length > 1 ? `Last request · ${index + 1} of ${list.length}` : `${index + 1} of ${list.length}`}
              </Chrome>
              <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", lineHeight: 36 }} size={28} accessibilityLiveRegion="polite">
                {request.text}
              </Chrome>
              {request.firstName === "" ? null : (
                <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
                  {`${request.firstName} asked`}
                </Chrome>
              )}
            </View>
          )}
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => (last ? leaveTogether() : step(index + 1))}
            accessibilityRole="button"
            accessibilityLabel={last ? "Done, leave praying together" : "Next request, for everyone"}
            style={[styles.next, { minHeight: pill, backgroundColor: BRAND.chartreuse }]}
            testID="together-next"
          >
            <Chrome style={{ color: BRAND.ink, fontWeight: "700" }}>{last ? "Done" : "Next"}</Chrome>
          </Pressable>
          <Pressable onPress={leaveTogether} accessibilityRole="button" accessibilityLabel="Leave praying together" style={[styles.round, { width: pill, height: pill, borderRadius: pill / 2, backgroundColor: dark ? SYSTEM.red.dark : SYSTEM.red.light }]} testID="together-leave">
            <Icon name="phone-end" size={24} color={ON_PICTURE.text} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", columnGap: 12, minHeight: 44 },
  people: { flexDirection: "row", gap: 12, marginTop: 18 },
  ask: { flexDirection: "row", alignItems: "center", columnGap: 12, borderRadius: 18, padding: 12, marginTop: 22 },
  middle: { flex: 1, justifyContent: "center", paddingVertical: 28 },
  controls: { flexDirection: "row", alignItems: "center", columnGap: 14 },
  next: { flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  round: { alignItems: "center", justifyContent: "center" },
});

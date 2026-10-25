/**
 * Praying together, as a call (Build 12 PC-36, PC-31, PC-37, PC-38; approved by John 25 Oct 2026: "follow voice calls
 * and video calls like Zoom, Meet", and "assumes there will always be a prayer"). On the circle's picture, blurred: the
 * call's time and the circle at the top, who is here as faces, then:
 * - opening (PC-36): what shall we pray? The circle's requests (when there are any), go round, today's verse, or a
 *   Bible prayer; Begin moves everyone.
 * - a request (PC-31), one person going round (PC-37), a verse of a prayer or today's verse, large;
 * - the end (PC-38): Amen, the day counts, how long and who.
 * Round labelled controls at the foot, as call apps have them: Next (everyone moves on), Add, Leave in red, the one red
 * in Yada (approved 25 Oct 2026). FaceTime carries the voices and tells no app about them, so there is no mute and no
 * ring on who is speaking; Add says where FaceTime adds people, since iOS gives no way into its sheet. Someone asking to
 * join shows as one line (PC-21).
 *
 * No polling (CLAUDE.md): asks are read when this screen opens, when Yada comes back from FaceTime, and when the number
 * of phones changes. The only timer is the on-screen clock, stopped when the screen closes.
 */

import { verseOrd } from "@yada/schema";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type CircleMember, type CircleRequest, circlesCloud, type TogetherMark } from "../../../modules/yada-pray";
import { Icon, type IconName } from "../../components/Icon";
import { Lamp } from "../../components/Lamp";
import { PictureGround } from "../../components/PictureGround";
import { Pill } from "../../components/Pill";
import { Avatar } from "../../components/pray/Avatar";
import { Chrome } from "../../components/Type";
import { useAppData, useCore } from "../../data/AppData";
import { PRAYERS_OF_THE_BIBLE } from "../../data/prayersOfTheBible";
import { getTextsInRange } from "../../data/queries";
import { dayVerse } from "../../data/today";
import { countDay, markDone } from "../../data/user";
import { ON_PICTURE, SYSTEM } from "../../design/palette";
import { FONTS, useIsDark, useLayout, usePalette } from "../../design/tokens";
import { onNow } from "../../lib/together";
import { nextPlace, packPlace, roundOrder, type TogetherMode, unpackPlace } from "../../lib/togetherPlan";
import { dayOf, partOf } from "../../lib/today";
import { leaveTogether, step, useTogether } from "../../data/together";

interface Step {
  readonly kicker: string;
  readonly text: string;
  readonly person?: CircleMember;
}

export default function Together() {
  const session = useTogether((s) => s.session);
  const code = useTogether((s) => s.index);
  const here = useTogether((s) => s.here);
  const startedAt = useTogether((s) => s.startedAt);
  const people = useTogether((s) => s.people);
  const core = useCore();
  const insets = useSafeAreaInsets();
  const { gutter, ax } = useLayout();
  const [requests, setRequests] = useState<CircleRequest[] | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [asks, setAsks] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [verse, setVerse] = useState<{ text: string; ref: string } | null>(null);
  const [prayerVerses, setPrayerVerses] = useState<string[]>([]);
  const [chosen, setChosen] = useState<TogetherMode | null>(null);
  const [choice, setChoice] = useState(0);
  const [pickingPrayer, setPickingPrayer] = useState(false);
  const place = unpackPlace(code);
  // How many of the circle's requests the call reached, for Amen: only those, never the circle's whole list (review).
  const requestsReached = useRef(0);
  if (place.mode === "requests") requestsReached.current = Math.max(requestsReached.current, place.index + 1);

  useEffect(() => {
    if (session === null || circlesCloud === null) return;
    void circlesCloud.requests(session.circle, session.owner).then(setRequests).catch(() => setRequests([]));
    void circlesCloud.members(session.circle, session.owner).then(setMembers).catch(() => setMembers([]));
    const at = new Date();
    // The BSB on every phone, so everyone reads the same words whatever their own translation (rule 9 holds).
    void dayVerse(core, "BSB", dayOf(at), partOf(at))
      .then((v) => setVerse(v === null ? null : { text: v.text, ref: v.ref }))
      .catch(() => setVerse(null));
  }, [session, core]);
  useEffect(() => {
    if (place.mode !== "prayer") return;
    const p = PRAYERS_OF_THE_BIBLE[place.choice];
    if (p === undefined) return;
    void getTextsInRange(core, verseOrd(p.book, p.chapter, p.from), verseOrd(p.book, p.chapter, p.to))
      .then((rows) => setPrayerVerses(rows.map((r) => r.texts.BSB ?? "").filter((t) => t !== "")))
      .catch(() => setPrayerVerses([]));
  }, [place.mode, place.choice, core]);
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
  // The call's clock: a countdown-style timer on screen, stopped when the screen closes (CLAUDE.md allows this one).
  useEffect(() => {
    const ticking = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticking);
  }, []);
  // The session ended elsewhere (FaceTime hung up, everyone left): back to the circle.
  useEffect(() => {
    if (session === null) router.back();
  }, [session]);

  const { user } = useAppData();
  // The end counts the day once, on every phone that reaches it.
  useEffect(() => {
    if (place.mode !== "end") return;
    void countDay(user).catch(() => undefined);
    void markDone(user, "pray").catch(() => undefined);
  }, [place.mode, user]);

  if (session === null) return null;
  const memberOf = (id: string): CircleMember => members.find((m) => m.id === id) ?? { id, name: "", joined: true, creator: false, me: false };
  const nameOf = (id: string) => memberOf(id).name;
  const faces = here.map(memberOf);
  const list = requests ?? [];
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const asking = asks.map(nameOf).map((n) => (n === "" ? "Someone" : n));

  const steps: Step[] =
    place.mode === "requests"
      ? list.map((r) => ({ kicker: r.firstName === "" ? "Asked in the circle" : `${r.firstName} asked`, text: r.text }))
      : place.mode === "round"
        ? roundOrder(here).map((id) => {
            const m = memberOf(id);
            return { kicker: "Going round", text: m.me ? "Pray for yourself" : `Pray for ${m.name === "" ? "this person" : m.name}`, person: m };
          })
        : place.mode === "verse"
          ? verse === null
            ? []
            : [{ kicker: `Today’s verse · ${verse.ref}`, text: verse.text }]
          : place.mode === "prayer"
            ? prayerVerses.map((t) => ({ kicker: PRAYERS_OF_THE_BIBLE[place.choice]?.title ?? "A Bible prayer", text: t }))
            : [];
  const current = steps[Math.min(place.index, steps.length - 1)];
  const label =
    place.mode === "choose" ? `Praying together · ${clock}` : place.mode === "end" ? "Praying together" : `${steps.length > 1 ? `${place.index + 1} of ${steps.length} · ` : ""}${clock}`;

  const begin = () => {
    const mode = chosen ?? (list.length > 0 ? "requests" : "round");
    step(packPlace({ mode, choice: mode === "prayer" ? choice : 0, index: 0 }));
  };
  // Nothing to step through yet (a prayer's verses still loading): Next waits rather than ending the call (review).
  const next = () => {
    if (steps.length === 0) return;
    step(packPlace(nextPlace(place, steps.length)));
  };
  const add = () =>
    Alert.alert("Add someone", "FaceTime adds people: tap the call’s controls at the top of the screen, then the person button.", [{ text: "OK" }]);

  if (place.mode === "end") return <Amen secs={secs} faces={faces} name={session.name} prayed={requestsReached.current} />;

  const options: Array<{ mode: TogetherMode; icon: IconName; title: string; line: string }> = [
    ...(list.length > 0 ? [{ mode: "requests" as const, icon: "people" as const, title: "The circle’s requests", line: `${list.length} asked` }] : []),
    { mode: "round", icon: "person", title: "Go round", line: "Pray for each person here" },
    ...(verse !== null ? [{ mode: "verse" as const, icon: "sit" as const, title: "Today’s verse", line: verse.ref }] : []),
    { mode: "prayer", icon: "book-open", title: "A Bible prayer", line: chosen === "prayer" ? (PRAYERS_OF_THE_BIBLE[choice]?.title ?? "") : `${PRAYERS_OF_THE_BIBLE.length} to choose from` },
  ];
  const picked = chosen ?? options[0]?.mode ?? "round";

  return (
    <View style={styles.root} testID="together">
      <PictureGround blurred day={session.picture} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20, paddingHorizontal: gutter }}>
        <View style={{ alignItems: "center" }}>
          <Chrome step="note" style={{ color: ON_PICTURE.muted, fontVariant: ["tabular-nums"] }}>
            {label}
          </Chrome>
          <Chrome accessibilityRole="header" style={{ color: ON_PICTURE.text, fontWeight: "600", marginTop: 2 }} size={22}>
            {session.name}
          </Chrome>
        </View>

        {place.mode === "round" && current?.person !== undefined ? null : (
          <View style={styles.people} accessible accessibilityLabel={`Here: ${faces.map((p) => (p.me ? "you" : p.name || "someone")).join(", ")}`}>
            {faces.map((p) => (
              <View key={p.id} style={[styles.face, { width: ax ? "50%" : "25%" }]}>
                <Avatar id={p.id} name={p.name} size={ax ? 60 : 56} onDark />
                <Chrome step="note" style={{ color: ON_PICTURE.strong }} numberOfLines={1}>
                  {p.me ? "You" : p.name || " "}
                </Chrome>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.middle, place.mode === "choose" ? { justifyContent: "flex-end" } : null]}>
          {place.mode === "choose" ? (
            pickingPrayer ? (
              <View>
                <Pressable onPress={() => setPickingPrayer(false)} accessibilityRole="button" style={styles.backRow}>
                  <Icon name="back" size={18} tone="white" />
                  <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>A Bible prayer</Chrome>
                </Pressable>
                {PRAYERS_OF_THE_BIBLE.map((p, i) => (
                  <Pressable
                    key={p.title}
                    onPress={() => {
                      setChosen("prayer");
                      setChoice(i);
                      setPickingPrayer(false);
                    }}
                    accessibilityRole="button"
                    style={[styles.option, { borderBottomColor: ON_PICTURE.track }]}
                  >
                    <Chrome style={{ color: ON_PICTURE.text, flex: 1 }}>{p.title}</Chrome>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View accessibilityRole="radiogroup" accessibilityLabel="What shall we pray?">
                <Chrome step="note" style={{ color: ON_PICTURE.strong, fontWeight: "600", marginBottom: 4 }}>
                  What shall we pray?
                </Chrome>
                {options.map((o) => {
                  const on = picked === o.mode;
                  return (
                    <Pressable
                      key={o.mode}
                      onPress={() => (o.mode === "prayer" ? setPickingPrayer(true) : setChosen(o.mode))}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${o.title}, ${o.line}`}
                      style={[styles.option, { borderBottomColor: ON_PICTURE.track }]}
                      testID={`together-${o.mode}`}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: ON_PICTURE.glass }]}>
                        <Icon name={o.icon} size={20} tone="white" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>{o.title}</Chrome>
                        <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
                          {o.line}
                        </Chrome>
                      </View>
                      {on ? <Icon name="check" size={18} tone="white" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )
          ) : current === undefined ? null : current.person !== undefined ? (
            <View style={{ alignItems: "center", rowGap: 14 }}>
              <Avatar id={current.person.id} name={current.person.name} size={ax ? 104 : 96} onDark />
              <Chrome style={[styles.big, { textAlign: "center" }]} maxFontSizeMultiplier={1.4} accessibilityLiveRegion="polite">
                {current.text}
              </Chrome>
              {current.person.me ? null : (
                <Chrome step="note" style={{ color: ON_PICTURE.strong, textAlign: "center" }}>
                  {`${current.person.name === "" ? "Is" : `${current.person.name}, is`} there anything you’d like prayer for?`}
                </Chrome>
              )}
            </View>
          ) : (
            <View style={{ rowGap: 12 }}>
              <Chrome step="note" style={{ color: ON_PICTURE.strong, fontWeight: "600" }}>
                {current.kicker}
              </Chrome>
              <Chrome style={styles.big} maxFontSizeMultiplier={1.4} accessibilityLiveRegion="polite">
                {current.text}
              </Chrome>
            </View>
          )}
        </View>

        {asking.length > 0 ? (
          <View style={styles.askLine} accessibilityLiveRegion="polite" testID="together-ask">
            <Avatar id={asks[0] ?? ""} name={asking[0] ?? ""} size={24} onDark />
            <Chrome step="note" style={{ color: ON_PICTURE.strong, flex: 1 }}>{`${asking.join(", ")} asked to join · Add lets them in`}</Chrome>
          </View>
        ) : null}

        {place.mode === "choose" && !pickingPrayer ? (
          <View style={{ marginBottom: 16 }}>
            <Pill title="Begin for everyone" onPicture stretch onPress={begin} testID="together-begin" />
          </View>
        ) : null}

        <View style={styles.controls}>
          <Control icon="forward" label={place.mode === "choose" ? "Skip" : "Next"} onPress={place.mode === "choose" ? begin : next} a11y={place.mode === "choose" ? "Skip choosing, begin" : "Next, for everyone"} testID="together-next" />
          <Control icon="plus" label="Add" onPress={add} a11y="Add someone" testID="together-add" />
          <Control icon="close" label="Leave" onPress={leaveTogether} a11y="Leave praying together" red testID="together-leave" />
        </View>
      </ScrollView>
    </View>
  );
}

function Control({ icon, label, onPress, a11y, red = false, testID }: { icon: IconName; label: string; onPress: () => void; a11y: string; red?: boolean; testID: string }) {
  const dark = useIsDark();
  const { ax } = useLayout();
  const size = ax ? 64 : 58;
  return (
    <View style={{ alignItems: "center", rowGap: 6 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: red ? (dark ? SYSTEM.red.dark : SYSTEM.red.light) : ON_PICTURE.glass, opacity: pressed ? 0.8 : 1 }]}
        testID={testID}
      >
        <Icon name={icon} size={22} tone="white" />
      </Pressable>
      <Chrome step="note" style={{ color: ON_PICTURE.strong }} accessibilityElementsHidden>
        {label}
      </Chrome>
    </View>
  );
}

/** PC-38: Amen, the day counts, how long and who prayed together; Done leaves the call's screen. */
function Amen({ secs, faces, name, prayed }: { secs: number; faces: CircleMember[]; name: string; prayed: number }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const minutes = Math.max(1, Math.round(secs / 60));
  const names = faces.map((f) => (f.me ? "you" : f.name)).filter((n) => n !== "");
  return (
    <View style={[styles.root, { backgroundColor: palette.paper }]} testID="together-amen">
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: gutter }}>
        <Chrome tone="ink" style={{ fontFamily: FONTS.scripture, fontWeight: "400" }} size={40} maxFontSizeMultiplier={1.1} accessibilityRole="header">
          Amen
        </Chrome>
        <View style={styles.counts}>
          <Lamp lit color={palette.accent} size={18} />
          <Chrome step="note" tone="muted">
            Today counts
          </Chrome>
        </View>
        <Chrome tone="ink" style={{ fontSize: 20, lineHeight: 26, fontWeight: "600", marginTop: 36 }}>{`${minutes} ${minutes === 1 ? "minute" : "minutes"} with ${name}`}</Chrome>
        <View style={[styles.counts, { marginTop: 12 }]}>
          {faces.slice(0, 4).map((f, i) => (
            <View key={f.id} style={i === 0 ? null : { marginLeft: -8 }}>
              <Avatar id={f.id} name={f.name} size={32} />
            </View>
          ))}
          <Chrome step="note" tone="muted" style={{ marginLeft: 8, flexShrink: 1 }}>
            {names.length === 0 ? "" : names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`}
          </Chrome>
        </View>
        {prayed > 0 ? (
          <Chrome step="note" tone="muted" style={{ marginTop: 12 }}>{`${prayed} ${prayed === 1 ? "request" : "requests"} in ${name}`}</Chrome>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 16 }}>
        <Pill title="Done" primary stretch onPress={leaveTogether} testID="together-done" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  people: { flexDirection: "row", flexWrap: "wrap", rowGap: 14, marginTop: 20 },
  face: { alignItems: "center", rowGap: 6 },
  middle: { flex: 1, justifyContent: "center", paddingVertical: 24 },
  big: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", fontSize: 30, lineHeight: 39, letterSpacing: -0.3 },
  option: { flexDirection: "row", alignItems: "center", columnGap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  backRow: { flexDirection: "row", alignItems: "center", columnGap: 6, minHeight: 44 },
  askLine: { flexDirection: "row", alignItems: "center", columnGap: 8, marginBottom: 16 },
  controls: { flexDirection: "row", justifyContent: "space-around" },
  counts: { flexDirection: "row", alignItems: "center", columnGap: 6, marginTop: 6 },
});


/**
 * New circle (PC-02 to PC-04), one sheet in three steps: what a circle is, before it exists (the twelve places; who sees
 * what; that it runs on iCloud); its name, with its cover taking shape as you type; then Invite, with the message people
 * get. Refs: Wise's group intro (mobbin.com/screens/98b98ff3-c274-4d68-ad82-fb8eefff9510), YouTube's "info you can and
 * can't see" (3392422d-74e6-468b-bbec-277d1391e0b7). Without iCloud it goes to the iCloud sheet (CI-03).
 *
 * Departure from PC-04: the frame has "Invite in Messages" and "Other ways to invite", but both open the same iOS sharing
 * sheet (UICloudSharingController, which offers Messages first), so it is one Invite button and Later.
 */

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, TextInput, View } from "react-native";

import { circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { Pill } from "../../components/Pill";
import { Fact } from "../../components/pray/Fact";
import { Ring } from "../../components/pray/Places";
import { SheetScreen } from "../../components/Sheet";
import { Chrome, Prose } from "../../components/Type";
import { BRAND, ON_PICTURE } from "../../design/palette";
import { FONTS, useIsDark, usePalette } from "../../design/tokens";
import { CIRCLE_MAX, circleParams, ICLOUD_WAIT_MS, withinTime } from "../../lib/pray";

const NAME_MAX = 40;

export default function NewCircle() {
  const palette = usePalette();
  const dark = useIsDark();
  const [step, setStep] = useState<"intro" | "name" | "invite">("intro");
  const [name, setName] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void prayCloud?.accountStatus().then((s) => {
      if (s !== "available") router.replace("/pray/icloud");
    });
  }, []);

  const create = async () => {
    if (circlesCloud === null || name.trim() === "") return;
    setBusy(true);
    setFailed(false);
    try {
      setId(await withinTime(circlesCloud.create(name.trim()), ICLOUD_WAIT_MS));
      setStep("invite");
    } catch {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility("iCloud didn’t answer. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const open = (sent: boolean) => {
    if (id === null) return;
    router.back();
    router.push({ pathname: "/pray/circle", params: { ...circleParams({ id, owner: "", name: name.trim(), owned: true, people: 1 }), ...(sent ? { sent: "1" } : {}) } });
  };
  const invite = async () => {
    if (id === null) return;
    const sent = await circlesCloud?.invite(id).catch(() => false);
    open(sent === true);
  };

  if (step === "intro")
    return (
      <SheetScreen title="New circle" backLabel={null} noBack footer={false} closeLabel="Not now" testID="new-circle">
        <View style={[styles.ring, { backgroundColor: dark ? BRAND.forestCardDark : BRAND.forest }]}>
          <Ring members={[{ id: "me", name: "", joined: true, creator: true, me: true }]} size={186}>
            <Chrome style={{ color: BRAND.chartreuse, fontFamily: FONTS.scripture, fontWeight: "400" }} size={30}>
              {String(CIRCLE_MAX)}
            </Chrome>
            <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
              people at most
            </Chrome>
          </Ring>
        </View>
        <Prose step="scripture" style={{ marginTop: 18 }}>
          Pray with the people you know.
        </Prose>
        <View style={styles.facts}>
          <Fact icon="people" title="Only people you invite" line="Nobody can find it or join uninvited." />
          <Fact icon="eye" title="They see what’s asked here" line="And how many prayed. Never who." />
          <Fact icon="lock" title="Never your list" line="Nor anything you ask outside the circle." />
          <Fact icon="cloud" title="Kept in iCloud" line="Everyone needs iCloud. Yada stores nothing." />
        </View>
        <View style={{ marginTop: 22 }}>
          <Pill title="Continue" onPress={() => setStep("name")} primary testID="new-circle-continue" />
        </View>
      </SheetScreen>
    );

  if (step === "name")
    return (
      <SheetScreen title="Name your circle" backLabel={null} noBack footer={false} keyboard testID="new-circle-name">
        <View style={[styles.cover, { backgroundColor: BRAND.forest }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" }} size={20}>
            {name.trim() === "" ? "Your circle" : name.trim()}
          </Chrome>
          <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
            1 person
          </Chrome>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => void create()}
          placeholder="Home group"
          placeholderTextColor={palette.mutedInk}
          style={[styles.field, { color: palette.ink }]}
          accessibilityLabel="The circle’s name"
          testID="new-circle-field"
        />
        <Chrome step="note" tone="muted">
          Everyone in the circle sees this name.
        </Chrome>
        <View style={{ marginTop: 22 }}>
          <Pill title={busy ? "Making it…" : "Next"} onPress={() => void create()} primary disabled={name.trim() === "" || busy} testID="new-circle-next" />
        </View>
        {failed ? (
          <Chrome step="note" tone="muted" style={{ marginTop: 10, textAlign: "center" }}>
            iCloud didn’t answer. Try again.
          </Chrome>
        ) : null}
      </SheetScreen>
    );

  return (
    <SheetScreen title={`Invite to ${name.trim()}`} backLabel={null} noBack footer={false} closeLabel="Later" testID="new-circle-invite">
      <View style={[styles.bubble, { backgroundColor: palette.card }]}>
        <Prose step="claim">I’ve started a prayer circle on Yada so we can pray for each other. Only people in it see what’s asked.</Prose>
      </View>
      <View style={[styles.link, { backgroundColor: palette.card }]}>
        <View style={[styles.linkTop, { backgroundColor: BRAND.forest }]}>
          <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" }} size={22}>
            {name.trim()}
          </Chrome>
        </View>
        <View style={{ padding: 12 }}>
          <Chrome tone="ink" style={{ fontWeight: "600" }}>{`Join ${name.trim()}`}</Chrome>
          <Chrome step="note" tone="muted">
            A prayer circle on Yada
          </Chrome>
        </View>
      </View>
      <View style={{ marginTop: 18 }}>
        <Fact icon="people" title={`${CIRCLE_MAX - 1} more can join`} line="Each person needs Yada and iCloud." />
      </View>
      <View style={{ marginTop: 22, rowGap: 10 }}>
        <Pill title="Invite" onPress={() => void invite()} primary testID="new-circle-share" />
        <Pill title="Later" onPress={() => open(false)} testID="new-circle-later" />
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  ring: { borderRadius: 26, height: 216, alignItems: "center", justifyContent: "center" },
  facts: { rowGap: 14, marginTop: 16 },
  cover: { alignSelf: "center", width: 132, height: 176, borderRadius: 20, padding: 14, justifyContent: "flex-end", marginBottom: 20 },
  field: { fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 38, minHeight: 44, marginBottom: 8 },
  bubble: { borderRadius: 20, borderBottomLeftRadius: 6, padding: 14, maxWidth: 320 },
  link: { width: 280, borderRadius: 18, overflow: "hidden", marginTop: 8 },
  linkTop: { height: 110, justifyContent: "flex-end", padding: 12 },
});

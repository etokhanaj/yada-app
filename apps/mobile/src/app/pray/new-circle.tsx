/**
 * New circle (Build 12 PC-33, approved by John 25 Oct 2026): one sheet. The circle's cover takes shape as you name it,
 * on the picture you choose from Yada's own (a circle keeps its picture, as moods and plans do); one line on who sees
 * it; Invite in Messages makes the circle and opens iOS's sharing sheet, Messages first. It replaces the three steps
 * of PC-02 to PC-04 (what a circle is, the name, the invite): the line and the sheet say what those pages did.
 * Without iCloud it goes to the iCloud sheet (CI-03).
 */

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { FillPicture } from "../../components/FillPicture";
import { Pill } from "../../components/Pill";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { pictureFor } from "../../data/pictures";
import { BRAND, ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { CIRCLE_MAX, circleParams, ICLOUD_WAIT_MS, withinTime } from "../../lib/pray";

const NAME_MAX = 40;
/** The pictures offered for a circle: calm, wide ones from the day pictures, the first chosen for you. */
const CHOICES = [13, 16, 1, 24, 7, 10];
const FADE = "linear-gradient(rgba(0,0,0,0) 30%, rgba(0,0,0,0.6))";

export default function NewCircle() {
  const palette = usePalette();
  const { gutter } = useLayout();
  const [name, setName] = useState("");
  const [picture, setPicture] = useState(CHOICES[0] ?? 13);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void prayCloud?.accountStatus().then((s) => {
      if (s !== "available") router.replace("/pray/icloud");
    });
  }, []);

  const title = name.trim();
  const make = async () => {
    if (circlesCloud === null || title === "") return;
    setBusy(true);
    setFailed(false);
    try {
      const id = await withinTime(circlesCloud.create(title, picture), ICLOUD_WAIT_MS);
      const sent = await circlesCloud.invite(id).catch(() => false);
      router.back();
      router.push({ pathname: "/pray/circle", params: { ...circleParams({ id, owner: "", name: title, owned: true, people: 1, picture }), ...(sent ? { sent: "1" } : {}) } });
    } catch {
      setFailed(true);
      AccessibilityInfo.announceForAccessibility("iCloud didn’t answer. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const cover = pictureFor(picture, "morning");
  return (
    <SheetScreen title="New circle" backLabel={null} noBack footer={false} keyboard closeLabel="Not now" testID="new-circle">
      <View style={[styles.cover, { backgroundColor: BRAND.forest }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {cover === undefined ? null : <FillPicture source={cover.image} />}
        <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: FADE }]} />
        <View style={{ padding: 16 }}>
          <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" }} size={26} numberOfLines={1}>
            {title === "" ? "Your circle" : title}
          </Chrome>
          <Chrome step="note" style={{ color: ON_PICTURE.strong }}>{`Up to ${CIRCLE_MAX} people`}</Chrome>
        </View>
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX}
        autoFocus
        returnKeyType="done"
        placeholder="Home group"
        placeholderTextColor={palette.mutedInk}
        style={[styles.field, { color: palette.ink, backgroundColor: palette.fill }]}
        accessibilityLabel="The circle’s name"
        testID="new-circle-field"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ columnGap: 8, paddingHorizontal: gutter }} accessibilityRole="radiogroup" accessibilityLabel="The circle’s picture">
        {CHOICES.map((n, i) => {
          const p = pictureFor(n, "morning");
          const on = n === picture;
          return (
            <Pressable
              key={n}
              onPress={() => setPicture(n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p?.alt ?? `Picture ${i + 1}`}
              style={[styles.thumb, { borderColor: on ? palette.ink : "transparent", backgroundColor: palette.card }]}
              testID={`new-circle-picture-${n}`}
            >
              <View style={styles.thumbInner}>{p === undefined ? null : <FillPicture source={p.image} />}</View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Chrome step="note" tone="muted" style={{ marginTop: 14 }}>
        Only people you invite can see it.
      </Chrome>
      <View style={{ marginTop: 18 }}>
        <Pill title={busy ? "Making it…" : "Invite in Messages"} onPress={() => void make()} primary stretch disabled={title === "" || busy} testID="new-circle-share" />
      </View>
      {failed ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 10, textAlign: "center" }}>
          iCloud didn’t answer. Try again.
        </Chrome>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 150, borderRadius: 24, overflow: "hidden", justifyContent: "flex-end", marginTop: 4 },
  field: { fontFamily: FONTS.scripture, fontSize: 21, lineHeight: 28, minHeight: 48, borderRadius: 24, paddingHorizontal: 16, marginVertical: 14 },
  thumb: { width: 62, height: 62, borderRadius: 16, borderWidth: 3, padding: 0 },
  thumbInner: { flex: 1, borderRadius: 13, overflow: "hidden" },
});

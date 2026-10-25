/**
 * Plan a time (Build 12 PC-35, approved by John 25 Oct 2026: the days as S M T W T F S across the width, a sheet as
 * tall as what it holds; PC-17 and PC-22 before it): the day large, then the time, weekly or once,
 * and about how long; everyone in the circle sees it and can say they'll come. A circle holds one planned time. Refs:
 * Canopi's "Every Sunday" in large type (mobbin.com/screens/62df0969-ea9c-4338-84d8-48aa32cecc68); Strava's weekly
 * repeat (c3065753-302b-4a90-9118-6cbad60f7db2).
 */

import { MenuView } from "@react-native-menu/menu";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";

import { circlesCloud } from "../../../modules/yada-pray";
import { FilterPills } from "../../components/FilterPills";
import { Icon } from "../../components/Icon";
import { Pill } from "../../components/Pill";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { allowNotices } from "../../data/together";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { clock, DAY_NAMES, LENGTHS, weekdayOf } from "../../lib/together";

export default function Plan() {
  const fitSheet = !useLayout().ax;
  const p = useLocalSearchParams<{ id?: string; owner?: string; name?: string; weekday?: string; hour?: string; minute?: string; weekly?: string; minutes?: string }>();
  const { id = "", owner = "", name = "Circle" } = p;
  const palette = usePalette();
  const [weekday, setWeekday] = useState(Number(p.weekday ?? weekdayOf(new Date())));
  const [time, setTime] = useState({ hour: Number(p.hour ?? 20), minute: Number(p.minute ?? 0) });
  const [weekly, setWeekly] = useState(p.weekly !== "0");
  const [minutes, setMinutes] = useState(Number(p.minutes ?? 20));
  const [busy, setBusy] = useState(false);

  // The first time is this coming one: the chosen day this week, or next week's if it has passed.
  const onceDate = () => {
    const now = new Date();
    const ahead = (weekday - weekdayOf(now) + 7) % 7;
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead, time.hour, time.minute);
    return at.getTime() > now.getTime() ? at : new Date(at.getFullYear(), at.getMonth(), at.getDate() + 7, time.hour, time.minute);
  };
  const save = async () => {
    if (circlesCloud === null) return;
    setBusy(true);
    try {
      // The first time as one moment, weekly or not: every phone shows it in its own clock (lib/together.ts nextTime).
      await circlesCloud.plan(id, owner, weekday, time.hour, time.minute, weekly, minutes, onceDate().getTime());
      await allowNotices().catch(() => false);
      router.back();
    } catch {
      AccessibilityInfo.announceForAccessibility("Couldn’t plan it. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const day = DAY_NAMES[weekday - 1] ?? "Monday";
  const option = (label: string, value: string, menu: { id: string; title: string }[], pick: (v: string) => void, testID: string) => (
    <MenuView shouldOpenOnLongPress={false} actions={menu} onPressAction={({ nativeEvent }) => pick(nativeEvent.event)}>
      <View style={[styles.opt, { borderTopColor: palette.divider }]} accessible accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} testID={testID}>
        <Chrome tone="muted">{label}</Chrome>
        <View style={styles.optRight}>
          <Chrome tone="ink" style={{ fontWeight: "600" }}>
            {value}
          </Chrome>
          <Icon name="down" size={14} tone="muted" />
        </View>
      </View>
    </MenuView>
  );

  return (
    <SheetScreen fit={fitSheet} title="Pray together" backLabel={null} noBack footer={false} closeLabel="Cancel" testID="plan">
      <Chrome accessibilityRole="header" tone="ink" style={{ fontFamily: FONTS.scripture, fontWeight: "400", letterSpacing: -0.6 }} size={34}>
        {weekly ? `Every ${day}` : `This ${day}`}
      </Chrome>
      <View style={styles.days} accessibilityRole="radiogroup" accessibilityLabel="Day">
        {DAY_NAMES.map((n, i) => {
          const on = weekday === i + 1;
          return (
            <Pressable
              key={n}
              onPress={() => setWeekday(i + 1)}
              accessibilityRole="radio"
              accessibilityLabel={n}
              accessibilityState={{ checked: on }}
              style={[styles.day, { backgroundColor: on ? palette.ink : palette.fill }]}
              testID={`plan-day-${i + 1}`}
            >
              <Chrome tone={on ? "paper" : "ink"} style={{ fontWeight: "600" }} maxFontSizeMultiplier={1.4}>
                {n.charAt(0)}
              </Chrome>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 14 }}>
        <FilterPills options={[{ key: "weekly", title: "Weekly" }, { key: "once", title: "Once" }]} chosen={weekly ? "weekly" : "once"} onChoose={(k) => setWeekly(k === "weekly")} testID="plan-repeats" />
      </View>

      <View style={{ marginTop: 8 }}>
        <View style={[styles.opt, { borderTopWidth: 0 }]}>
          <Chrome tone="muted">Time</Chrome>
          <DateTimePicker
            mode="time"
            display="compact"
            value={new Date(2000, 0, 1, time.hour, time.minute)}
            onValueChange={(_, d) => setTime({ hour: d.getHours(), minute: d.getMinutes() })}
            accessibilityLabel={`Time: ${clock(time.hour, time.minute)}`}
            testID="plan-time"
          />
        </View>
        {option("For about", `${minutes} min`, LENGTHS.map((m) => ({ id: String(m), title: `${m} minutes` })), (v) => setMinutes(Number(v)), "plan-length")}
      </View>

      <Chrome step="note" tone="muted" style={{ marginTop: 12 }}>{`Everyone in ${name} sees it.`}</Chrome>
      <View style={{ marginTop: 18 }}>
        <Pill title={busy ? "Planning…" : "Plan it"} onPress={() => void save()} primary stretch disabled={busy} testID="plan-save" />
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: "row", justifyContent: "space-between", columnGap: 6, marginTop: 16 },
  // Seven equal circles across the width at every text size: at AX sizes they wrapped onto two rows (PC-35).
  day: { flex: 1, aspectRatio: 1, maxWidth: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  opt: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth },
  optRight: { flexDirection: "row", alignItems: "center", columnGap: 6 },
});

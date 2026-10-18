/**
 * Asking for the reminder (canvas NP-01, NP-02, and RT-05 from build 10a; John, 15 and 18 Oct 2026). Shown once the first
 * passage is read: one question, "When will you read?", four ways in, and the time that follows the answer. Picking a
 * tile sets the reminder's time; the "Remind me at 7:30" pill opens the time picker. iOS asks only after Remind me,
 * because its prompt comes once: a No given before the reminder was seen could never be asked again. Not now is as easy
 * as Remind me, and is the way out: the page has no other control, as the frame draws it.
 *
 * "After I… I'll read" is a plan the reader makes in their own words (Gollwitzer's if-then plan, docs/build-10-plan.md
 * 10a). Tiles after Ten Percent Happier (https://mobbin.com/screens/09d86e92-f3ef-4e0b-a780-786177c1c56c) and pillowtalk
 * (https://mobbin.com/screens/a5a4cdb0-0400-4314-a6b8-bd37c673fb9f): a line icon and the time on each. Rejected: emoji and
 * a yellow gradient (BitePal).
 *
 * It sets the one existing reminder (Settings › Reminder, DR-05) to a single time; Settings keeps both reminders.
 * Permission refused: nothing nags, and the Reminder page says the rest (NT-10). At AX sizes the pill drops "Remind me at"
 * and keeps the time (UI audit, 18 Oct 2026).
 */

import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { Icon } from "../components/Icon";
import { Chrome } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { changeReminder, notNow, turnOnFromAsk, useReminder } from "../data/reminder";
import { FONTS, useLayout, usePalette } from "../design/tokens";
import { ANCHORS, type AnchorId, anchorAt } from "../lib/lapse";
import { timeLabel } from "../lib/reminder";

export default function RemindAskScreen() {
  const { user } = useAppData();
  const core = useCore();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { ax, pill, gutter } = useLayout();
  const prefs = useReminder((s) => s.prefs);
  const chosen = anchorAt(prefs.hour, prefs.minute);
  const [picking, setPicking] = useState(false);

  // Closed any way but Remind me, it counts as Not now: asked once more, later (NP-03).
  const turnedOn = useRef(false);
  useEffect(
    () => () => {
      if (!turnedOn.current) void notNow(user);
    },
    [user],
  );
  const setTime = (hour: number, minute: number) => void changeReminder(user, core, { ...prefs, hour, minute });

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }} testID="remind-ask">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: gutter, paddingBottom: 24 }}>
        <Chrome tone="ink" accessibilityRole="header" maxFontSizeMultiplier={1.8} style={styles.question}>
          When will you read?
        </Chrome>
        <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="When will you read?">
          {ANCHORS.map((a) => {
            const on = chosen === a.id;
            const ink = on ? palette.paper : palette.ink;
            return (
              <Pressable
                key={a.id}
                onPress={() => setTime(a.hour, a.minute)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${a.label}, ${timeLabel(a)}`}
                style={({ pressed }) => [
                  styles.tile,
                  { backgroundColor: on ? palette.accent : palette.fill, opacity: pressed ? 0.85 : 1, minHeight: ax ? 170 : 128, flexBasis: ax ? "100%" : "47%" },
                ]}
                testID={`remind-ask-${a.id}`}
              >
                <AnchorIcon id={a.id} color={ink} size={32} />
                <View style={{ rowGap: 3 }}>
                  <Chrome style={{ color: ink, fontWeight: "600" }}>{a.label}</Chrome>
                  <Chrome step="note" style={{ color: ink, opacity: 0.7, fontWeight: "500", fontVariant: ["tabular-nums"] }}>
                    {timeLabel(a)}
                  </Chrome>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => setPicking((p) => !p)}
          accessibilityRole="button"
          accessibilityLabel={`Remind me at ${timeLabel(prefs)}. Change the time`}
          accessibilityState={{ expanded: picking }}
          style={({ pressed }) => [styles.time, { backgroundColor: palette.fill, opacity: pressed ? 0.85 : 1 }]}
          testID="remind-ask-time"
        >
          {ax ? null : <Chrome tone="muted">Remind me at</Chrome>}
          <Chrome tone="ink" maxFontSizeMultiplier={1.6} style={styles.timeValue}>
            {timeLabel(prefs)}
          </Chrome>
          <Icon name={picking ? "up" : "down"} size={16} tone="muted" />
        </Pressable>
        {picking ? (
          <DateTimePicker
            mode="time"
            display="spinner"
            value={new Date(2000, 0, 1, prefs.hour, prefs.minute)}
            onValueChange={(_, date) => setTime(date.getHours(), date.getMinutes())}
            testID="remind-ask-picker"
          />
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 12, paddingTop: 12, rowGap: 6 }}>
        <Pressable
          onPress={() => {
            turnedOn.current = true;
            // Whatever iOS answers, or if asking fails, the page closes: the Reminder page says the rest (NT-10).
            void turnOnFromAsk(user, core, prefs)
              .catch(() => undefined)
              .then(() => router.back());
          }}
          accessibilityRole="button"
          accessibilityHint="iPhone will ask to allow notifications"
          style={({ pressed }) => [styles.button, { minHeight: pill, backgroundColor: palette.accent, opacity: pressed ? 0.8 : 1 }]}
          testID="remind-ask-on"
        >
          <Chrome tone="paper" style={{ fontWeight: "600" }} numberOfLines={1}>
            Remind me
          </Chrome>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={({ pressed }) => [styles.later, { opacity: pressed ? 0.6 : 1 }]} testID="remind-ask-later">
          <Chrome tone="muted" style={{ fontWeight: "600" }}>
            Not now
          </Chrome>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  question: { fontFamily: FONTS.scripture, fontSize: 32, lineHeight: 38, fontWeight: "600", letterSpacing: -0.5 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 28 },
  tile: { flexGrow: 1, borderRadius: 24, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16, justifyContent: "space-between" },
  time: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", columnGap: 12, minHeight: 44, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 30 },
  timeValue: { fontFamily: FONTS.scripture, fontSize: 44, lineHeight: 50, fontWeight: "600", letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  button: { borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  later: { alignSelf: "center", minHeight: 48, minWidth: 88, alignItems: "center", justifyContent: "center" },
});

/**
 * The four times of day on RT-05's tiles: line icons on the 24-unit grid, drawn here because Untitled UI's set has no
 * sunrise or sunset. Decorative: the tile carries the label and the time. Only this screen uses them.
 */
const PATHS: Record<Exclude<AnchorId, "midday" | "bed">, string> = {
  wake: "M3 17h18M7 17a5 5 0 0 1 10 0M12 6v3M5.5 9.5l1.7 1.7M18.5 9.5l-1.7 1.7",
  work: "M3 13h18M7 13a5 5 0 0 1 10 0M7 17h10M10 20.5h4",
};

function AnchorIcon({ id, color, size = 40 }: { id: AnchorId; color: string; size?: number }) {
  const common = { stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {id === "midday" ? (
        <>
          <Circle cx={12} cy={12} r={4} {...common} />
          <Path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" {...common} />
        </>
      ) : id === "bed" ? (
        <Path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z" {...common} />
      ) : (
        <Path d={PATHS[id]} {...common} />
      )}
    </Svg>
  );
}

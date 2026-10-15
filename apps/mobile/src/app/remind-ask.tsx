/**
 * Asking for the reminder (canvas NP-01, NP-02; John, 15 Oct 2026). Shown once the first passage is read: the
 * notification Yada would send, the time, Turn on and Not now. iOS asks only after Turn on, because its prompt
 * comes once: a No given before the reminder was seen could never be asked again. In context with a way out, as
 * Todoist (https://mobbin.com/screens/71e24632-b2d1-46e8-8a2f-91950219b23a) and How We Feel
 * (https://mobbin.com/screens/220a74a9-69cb-4786-91fc-7c0436810dcf) ask; no urgency, no mascot.
 */

import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ReminderPreview } from "../components/ReminderPreview";
import { SheetScreen } from "../components/Sheet";
import { Chrome } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { changeReminder, notNow, previewReminder, turnOnFromAsk, useReminder } from "../data/reminder";
import { useLayout, usePalette } from "../design/tokens";
import { type ReminderText, timeLabel } from "../lib/reminder";

export default function RemindAskScreen() {
  const { user } = useAppData();
  const core = useCore();
  const palette = usePalette();
  const { ax } = useLayout();
  const prefs = useReminder((s) => s.prefs);
  const [preview, setPreview] = useState<ReminderText | null>(null);

  useEffect(() => {
    let live = true;
    void previewReminder(user, core, prefs.kind).then((t) => live && setPreview(t));
    return () => {
      live = false;
    };
  }, [user, core, prefs.kind]);

  // Closed any way but Turn on (×, a swipe down, Not now), it counts as Not now: asked once more, later (NP-03).
  const turnedOn = useRef(false);
  useEffect(
    () => () => {
      if (!turnedOn.current) void notNow(user);
    },
    [user],
  );
  const later = () => router.back();

  return (
    <SheetScreen title="A reminder to read" backLabel={null} noBack footer={false} closeLabel="Not now" testID="remind-ask">
      {preview !== null ? <ReminderPreview text={preview} time={timeLabel(prefs)} /> : null}
      <View style={[styles.timeRow, ax ? { flexDirection: "column", alignItems: "flex-start" } : null]}>
        <Chrome tone="ink">Every day</Chrome>
        <DateTimePicker
          mode="time"
          display="compact"
          value={new Date(2000, 0, 1, prefs.hour, prefs.minute)}
          onValueChange={(_, date) => void changeReminder(user, core, { ...prefs, hour: date.getHours(), minute: date.getMinutes() })}
          accessibilityLabel="Time"
          testID="remind-ask-time"
        />
      </View>
      <Pressable
        onPress={() => {
          turnedOn.current = true;
          // Whatever iOS answers, or if asking fails, the sheet closes: the Reminder page says the rest (NT-10).
          void turnOnFromAsk(user, core, prefs)
            .catch(() => undefined)
            .then(() => router.back());
        }}
        accessibilityRole="button"
        accessibilityHint="iPhone will ask to allow notifications"
        style={({ pressed }) => [styles.button, { backgroundColor: palette.ink, opacity: pressed ? 0.7 : 1 }]}
        testID="remind-ask-on"
      >
        <Chrome tone="paper" style={{ fontWeight: "600" }} numberOfLines={1}>
          Turn on
        </Chrome>
      </Pressable>
      <Pressable onPress={later} accessibilityRole="button" style={({ pressed }) => [styles.later, { opacity: pressed ? 0.6 : 1 }]} testID="remind-ask-later">
        <Chrome tone="ink" style={{ fontWeight: "500" }}>
          Not now
        </Chrome>
      </Pressable>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, rowGap: 8, marginTop: 20 },
  button: { marginTop: 20, minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  later: { alignSelf: "center", minHeight: 44, minWidth: 88, alignItems: "center", justifyContent: "center", marginTop: 6 },
});

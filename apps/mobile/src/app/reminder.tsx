/**
 * Reminder (canvas NT-02, NT-03, NT-10; reached from Settings, ST-01, and once from the passage guide after
 * a passage is finished, NT-01). The reminder is shown before iOS asks anything: what it will say, the
 * time and days, and which words. iOS asks only on Turn on (NT-03). If iOS says no, one sentence and the
 * way to Settings, no nagging (NT-10).
 *
 * The preview is the notification as iOS draws it, the one place a rounded block appears: it is the
 * thing itself, not a card (CLAUDE.md design rules).
 */

import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, View } from "react-native";

import { ListRow, PageScreen } from "../components/Page";
import { Icon } from "../components/Icon";
import { ReminderPreview } from "../components/ReminderPreview";
import { SectionTitle, Chrome } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { changeReminder, previewReminder, turnOff, turnOn, useReminder } from "../data/reminder";
import { useLayout, usePalette } from "../design/tokens";
import { loadSettings } from "../data/user";
import { parsePsalter } from "../lib/dailyPsalms";
import { DEFAULT_EVENING, type ReminderPrefs, type ReminderText, timeLabel } from "../lib/reminder";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ReminderScreen() {
  const { user } = useAppData();
  const core = useCore();
  const palette = usePalette();
  const { ax, sectionGap } = useLayout();
  const prefs = useReminder((s) => s.prefs);
  const permission = useReminder((s) => s.permission);
  const [preview, setPreview] = useState<ReminderText | null>(null);
  // The evening time is offered only under the 1662 table, the one with an evening set (DR-04).
  const [psalter1662, setPsalter1662] = useState(false);
  useEffect(() => {
    void loadSettings(user).then((s) => setPsalter1662(parsePsalter(s["dailyPsalms"]) === "1662"));
  }, [user]);

  useEffect(() => {
    let live = true;
    void previewReminder(user, core, prefs.kind).then((t) => live && setPreview(t));
    return () => {
      live = false;
    };
  }, [user, core, prefs.kind]);

  const change = (next: ReminderPrefs) => void changeReminder(user, core, next);
  const everyDay = prefs.days.every(Boolean);
  const denied = permission === "denied";

  return (
    <PageScreen title="Reminder" back="Back" testID="reminder">
      {denied ? (
        // NT-10: one sentence and the way there.
        <View style={{ rowGap: 8, marginBottom: sectionGap }} testID="reminder-denied">
          <Chrome step="note" tone="muted">
            Notifications are off for Yada in iPhone Settings.
          </Chrome>
          <ListRow first title="Open Settings" onPress={() => void Linking.openSettings()} testID="reminder-open-settings" />
        </View>
      ) : preview !== null ? (
        <ReminderPreview text={preview} time={timeLabel(prefs)} />
      ) : null}

      <SectionTitle style={{ marginTop: sectionGap, marginBottom: 6 }}>Time</SectionTitle>
      <View style={[styles.timeRow, ax ? { flexDirection: "column", alignItems: "flex-start" } : null]}>
        <Chrome tone="ink">{everyDay ? "Every day" : `${prefs.days.filter(Boolean).length} days a week`}</Chrome>
        <DateTimePicker
          mode="time"
          display="compact"
          value={new Date(2000, 0, 1, prefs.hour, prefs.minute)}
          onValueChange={(_, date) => change({ ...prefs, hour: date.getHours(), minute: date.getMinutes() })}
          accessibilityLabel="Time"
          testID="reminder-time"
        />
      </View>
      {/* One row of seven, as NT-02 sets them; they wrap only at the AX sizes. */}
      <View style={[styles.days, ax ? { flexWrap: "wrap", gap: 8 } : { justifyContent: "space-between" }]} accessibilityRole="toolbar" accessibilityLabel="Days">
        {DAYS.map((d, i) => {
          const on = prefs.days[i] === true;
          return (
            <Pressable
              key={i}
              onPress={() => {
                const days = prefs.days.map((v, k) => (k === i ? !v : v));
                // One day at least: a reminder on no days is Turn off, which is its own button.
                if (days.some(Boolean)) change({ ...prefs, days });
              }}
              accessibilityRole="switch"
              accessibilityLabel={DAY_NAMES[i]}
              accessibilityState={{ checked: on }}
              style={[styles.day, { width: ax ? 64 : 44, height: ax ? 64 : 44, backgroundColor: on ? palette.ink : palette.fill }]}
              testID={`reminder-day-${i}`}
            >
              <Chrome tone={on ? "paper" : "ink"} style={{ fontWeight: "600" }} maxFontSizeMultiplier={1.4}>
                {d}
              </Chrome>
            </Pressable>
          );
        })}
      </View>

      {psalter1662 ? (
        <View style={{ marginTop: 16 }}>
          <ListRow
            first
            title="This evening’s psalms"
            chevron={false}
            right={
              <Switch
                value={prefs.evening !== null}
                onValueChange={(on) => change({ ...prefs, evening: on ? DEFAULT_EVENING : null })}
                accessibilityLabel="This evening’s psalms"
                testID="reminder-evening"
              />
            }
          />
          {prefs.evening !== null ? (
            <View style={[styles.timeRow, ax ? { flexDirection: "column", alignItems: "flex-start" } : null]}>
              <Chrome tone="ink">Evening</Chrome>
              <DateTimePicker
                mode="time"
                display="compact"
                value={new Date(2000, 0, 1, prefs.evening.hour, prefs.evening.minute)}
                onValueChange={(_, date) => change({ ...prefs, evening: { hour: date.getHours(), minute: date.getMinutes() } })}
                accessibilityLabel="Evening time"
                testID="reminder-evening-time"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* NB-04 (build 8, John 17 Oct 2026): Sunday's week in review, off until turned on; it rides on Sunday's
          reminder, or comes alone at 18:00 when none is set that day, so never two in a day. */}
      <SectionTitle style={{ marginTop: sectionGap, marginBottom: 6 }}>Sunday</SectionTitle>
      <ListRow
        first
        title="Week in review"
        subtitle="How many days you read that week"
        chevron={false}
        right={
          <Switch value={prefs.weekly} onValueChange={(weekly) => change({ ...prefs, weekly })} accessibilityLabel="Week in review" testID="reminder-weekly" />
        }
      />

      <SectionTitle style={{ marginTop: sectionGap, marginBottom: 6 }}>What it says</SectionTitle>
      {(
        [
          ["next", "The next passage", "Where you are in John, or your plan"],
          ["today", "A passage for today", "One verse, the same for everyone that day"],
        ] as const
      ).map(([kind, title, note], i) => (
        <ListRow
          key={kind}
          first={i === 0}
          chevron={false}
          chosen={prefs.kind === kind}
          title={title}
          subtitle={note}
          right={prefs.kind === kind ? <Icon name="check" size={20} tone="accent" /> : undefined}
          onPress={() => change({ ...prefs, kind })}
          testID={`reminder-kind-${kind}`}
        />
      ))}
      <Chrome step="note" tone="muted" style={{ marginTop: 12 }}>
        Made on this iPhone. Nothing about your reading is sent anywhere.
      </Chrome>

      {denied ? null : (
        <Pressable
          onPress={() => void (prefs.on ? turnOff(user) : turnOn(user, core, prefs))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { backgroundColor: prefs.on ? palette.fill : palette.ink, opacity: pressed ? 0.7 : 1 }]}
          testID="reminder-toggle"
        >
          <Chrome tone={prefs.on ? "ink" : "paper"} style={{ fontWeight: "600" }} numberOfLines={1}>
            {prefs.on ? "Turn off" : "Turn on"}
          </Chrome>
        </Pressable>
      )}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, rowGap: 8 },
  days: { flexDirection: "row", marginTop: 8 },
  day: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  button: { marginTop: 24, minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
});

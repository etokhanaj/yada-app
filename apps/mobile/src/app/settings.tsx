/**
 * Settings (canvas ST-01, ST-03, DN-04; IA v3, IA-11): eight real choices, each row showing its value,
 * then About and Remove my data. Reached from Home › ⋯; the reader's Aa stays the shortcut to Text and
 * appearance (ST-05). Apple Settings' grouped rows with the value trailing
 * (https://mobbin.com/screens/9343e7b1-2483-4855-9655-0785d42c88a6), plain rows with no cards.
 *
 * Remove my data asks once, in an alert that names exactly what goes and where; when a download is under
 * way it says that stops first (DN-04).
 */

import { MenuView } from "@react-native-menu/menu";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Switch, View } from "react-native";

import { ListRow, PageScreen } from "../components/Page";
import { Chrome, Label } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { setSpeed, chooseReading } from "../data/audio";
import { cloudAvailable, setCloudPaused } from "../data/cloud";
import { readingsOnPhone, useRecordings } from "../data/recordings";
import { useReminder } from "../data/reminder";
import { downloadUnderWay, removeMyData } from "../data/removeData";
import { useStudy } from "../data/study";
import { useTranslations } from "../data/translations";
import { useUnderstand } from "../data/understand";
import { loadSettings, saveSetting } from "../data/user";
import { useLayout, usePalette } from "../design/tokens";
import { SPEEDS, speedLabel } from "../lib/audio/session";
import { compareSelection, listAnd } from "../lib/compare";
import { onPhoneOrder } from "../lib/translations";
import { BUILT_IN } from "../data/queries";
import { formatMB } from "../lib/progress";
import { PSALTER_CHOICES, type PsalterChoice, parsePsalter } from "../lib/dailyPsalms";
import { reminderSummary } from "../lib/reminder";
import { useAudio } from "../state/audio";
import { TEXT_SCALES, useSettings } from "../state/settings";

const VOICES = [
  { id: "heart", name: "Heart" },
  { id: "george", name: "George" },
] as const;

export default function SettingsScreen() {
  const { user } = useAppData();
  const core = useCore();
  const palette = usePalette();
  const { sectionGap, ax } = useLayout();
  const textScale = useSettings((s) => s.textScale);
  const appearance = useSettings((s) => s.appearance);
  const translation = useSettings((s) => s.translation);
  const compareWith = useSettings((s) => s.compareWith);
  const speed = useAudio((s) => s.speed);
  const narrator = useRecordings((s) => s.narrator);
  const prefs = useReminder((s) => s.prefs);
  const translations = useTranslations((s) => s.installed);
  const study = useStudy((s) => s.installed);
  const understand = useUnderstand((s) => s.installed);
  const [icloud, setIcloud] = useState(true);
  const [psalter, setPsalter] = useState<PsalterChoice>("1662");
  const [readingBytes, setReadingBytes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void loadSettings(user).then((s) => {
        setIcloud(s["icloud"] !== "off");
        setPsalter(parsePsalter(s["dailyPsalms"]));
      });
      setReadingBytes(readingsOnPhone().reduce((n, r) => n + r.bytes, 0));
    }, [user]),
  );

  const size = `Size ${Math.max(0, TEXT_SCALES.findIndex((s) => s === textScale)) + 1}`;
  const look = appearance === "light" ? "Light" : appearance === "dark" ? "Dark" : "System";
  const downloads =
    translations.reduce((n, t) => n + t.bytes, 0) +
    Object.values(study).reduce((n, f) => n + (f?.shipped === true ? 0 : (f?.bytes ?? 0)), 0) +
    Object.values(understand).reduce((n, f) => n + (f?.shipped === true ? 0 : (f?.bytes ?? 0)), 0) +
    readingBytes;
  const comparing = compareSelection(translation, onPhoneOrder(BUILT_IN, translations.map((t) => t.code)), compareWith);
  const voiceName = VOICES.find((v) => v.id === narrator)?.name ?? "Heart";
  const version = `${Constants.expoConfig?.version ?? ""} (${Constants.expoConfig?.ios?.buildNumber ?? ""})`;

  const confirmRemove = () => {
    const what = "bookmarks, your reading place, plan progress, your rhythm, the reminder and downloads";
    Alert.alert(
      "Remove your data?",
      downloadUnderWay()
        ? `The download stops, then ${what} are removed from this iPhone and iCloud. This can’t be undone.`
        : `${what[0]?.toUpperCase()}${what.slice(1)} will be removed from this iPhone and from your iCloud. This can’t be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void removeMyData(user, core).then(() => router.dismissTo("/")) },
      ],
    );
  };

  // One line at standard sizes; at AX sizes the value wraps rather than cut "Compare with" short.
  const value = (text: string) => (
    <Chrome tone="muted" numberOfLines={ax ? undefined : 1}>
      {text}
    </Chrome>
  );

  return (
    <PageScreen title="Settings" testID="settings">
      <Label style={{ marginBottom: 6 }}>Reading</Label>
      <ListRow first title="Text and appearance" right={value(`${size} · ${look}`)} onPress={() => router.push("/type-settings")} label={`Text and appearance, ${size}, ${look}`} testID="settings-text" />
      <ListRow title="Translation" right={value(translation)} onPress={() => router.push("/translations")} label={`Translation, ${translation}`} testID="settings-translation" />
      <ListRow
        title="Compare with"
        // ST-01 names the versions themselves: the reader's choice, or the first three on the phone.
        right={value(comparing.join(", "))}
        onPress={() => router.push("/evidence/choose")}
        label={`Compare with, ${listAnd(comparing)}`}
        testID="settings-compare"
      />

      <Label style={{ marginTop: sectionGap, marginBottom: 6 }}>Listening</Label>
      <MenuView
        shouldOpenOnLongPress={false}
        actions={VOICES.map((v) => ({ id: v.id, title: v.name, subtitle: "Computer voice", state: v.id === narrator ? ("on" as const) : ("off" as const), imageColor: palette.ink }))}
        onPressAction={({ nativeEvent }) => void chooseReading(nativeEvent.event)}
        testID="settings-voice"
      >
        {/* The menu is a UIButton; a child that took the touch would keep it from opening (index.tsx). */}
        <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel={`Voice, ${voiceName}, computer voice`}>
          <ListRow first title="Voice" right={value(voiceName)} chevron={false} />
        </View>
      </MenuView>
      <MenuView
        shouldOpenOnLongPress={false}
        actions={SPEEDS.map((s) => ({ id: String(s), title: speedLabel(s), state: s === speed ? ("on" as const) : ("off" as const), imageColor: palette.ink }))}
        onPressAction={({ nativeEvent }) => setSpeed(Number(nativeEvent.event))}
        testID="settings-speed"
      >
        <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel={`Speed, ${speed} times`}>
          <ListRow title="Speed" right={value(speedLabel(speed))} chevron={false} />
        </View>
      </MenuView>

      {/* DR-04: Today's reading card follows this; a native menu as Voice and Speed above. */}
      <Label style={{ marginTop: sectionGap, marginBottom: 6 }}>Today</Label>
      <MenuView
        shouldOpenOnLongPress={false}
        actions={PSALTER_CHOICES.map((c) => ({ id: c.id, title: c.title, state: c.id === psalter ? ("on" as const) : ("off" as const), imageColor: palette.ink }))}
        onPressAction={({ nativeEvent }) => {
          const next = parsePsalter(nativeEvent.event);
          setPsalter(next);
          void saveSetting(user, "dailyPsalms", next);
        }}
        testID="settings-psalms"
      >
        <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel={`Daily psalms, ${PSALTER_CHOICES.find((c) => c.id === psalter)?.title ?? ""}`}>
          <ListRow first title="Daily psalms" right={value(PSALTER_CHOICES.find((c) => c.id === psalter)?.title ?? "")} chevron={false} />
        </View>
      </MenuView>

      <Label style={{ marginTop: sectionGap, marginBottom: 6 }}>Reminder</Label>
      <ListRow first title="Reminder" right={value(reminderSummary(prefs))} onPress={() => router.push("/reminder")} label={`Reminder, ${reminderSummary(prefs)}`} testID="settings-reminder" />

      <Label style={{ marginTop: sectionGap, marginBottom: 6 }}>On this iPhone</Label>
      <ListRow first title="Downloads" right={value(downloads === 0 ? "None" : formatMB(downloads))} onPress={() => router.push("/downloads")} label={`Downloads, ${downloads === 0 ? "none" : formatMB(downloads)}`} testID="settings-downloads" />
      {cloudAvailable() ? (
        <ListRow
          title="iCloud"
          chevron={false}
          right={
            <Switch
              value={icloud}
              onValueChange={(on) => {
                setIcloud(on);
                setCloudPaused(!on);
                void saveSetting(user, "icloud", on ? "on" : "off");
              }}
              accessibilityLabel="iCloud"
              testID="settings-icloud"
            />
          }
        />
      ) : null}

      <Label style={{ marginTop: sectionGap, marginBottom: 6 }}>About</Label>
      <ListRow first title="Sources and licences" onPress={() => router.push("/sources")} testID="settings-sources" />
      <ListRow title="Version" right={value(version)} chevron={false} label={`Version ${version}`} />

      <View style={{ marginTop: sectionGap }}>
        {/* Ink, as ST-01 sets it: the alert's Remove is the one destructive red. */}
        <ListRow first title="Remove my data" chevron={false} onPress={confirmRemove} testID="settings-remove" />
      </View>
    </PageScreen>
  );
}

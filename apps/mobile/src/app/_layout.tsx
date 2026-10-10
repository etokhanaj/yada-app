/**
 * Root: fonts, bundles, the reader's settings, then the routes.
 *
 * Everything the reading surface needs is opened here, once, before any
 * screen renders — so no screen shows a loading state for its own data
 * (the design brief rules out skeletons in reading).
 */

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useLayoutEffect, useState } from "react";
import { AccessibilityInfo, Appearance, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LaunchStage } from "../components/LaunchOverlay";
import { type AppData, AppDataProvider } from "../data/AppData";
import { installBundles, openCore, openUser } from "../data/bundles";
import { loadSettings, saveSetting } from "../data/user";
import { SHEET_MEDIUM, useAXLevel, useIsDark, usePalette } from "../design/tokens";
import { watchAccessibility } from "../state/accessibility";
import { useSettings } from "../state/settings";

// The splash (brief §8.16) stays until LaunchStage draws its copy, which then
// lifts away once the first screen is ready (§8.17).
void SplashScreen.preventAutoHideAsync();

async function start(): Promise<AppData> {
  const user = await openUser();
  await installBundles(user);
  const core = await openCore();
  useSettings.getState().hydrate(await loadSettings(user));
  return { core, user };
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Literata: require("../../assets/fonts/Literata.ttf"),
    GentiumPlus: require("../../assets/fonts/GentiumPlus-Regular.ttf"),
    NotoSerifHebrew: require("../../assets/fonts/NotoSerifHebrew.ttf"),
  });
  const [data, setData] = useState<AppData | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const appearance = useSettings((s) => s.appearance);
  const palette = usePalette();
  const isDark = useIsDark();
  const ax = useAXLevel() >= 1;

  useEffect(() => {
    start().then(setData, (error: unknown) => setFailure(String(error)));
  }, []);

  useEffect(watchAccessibility, []);

  // Read directly: the accessibility store may not have filled before the first frame.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => setReduceMotion(false));
  }, []);
  // A font that cannot load is a failure to report, not a splash held forever.
  useEffect(() => {
    if (fontError) setFailure(String(fontError));
  }, [fontError]);
  useEffect(() => {
    if (failure !== null) {
      void SplashScreen.hideAsync();
    }
  }, [failure]);

  // Native sheets, the keyboard and system controls follow the reader's
  // choice, not only Yada's own views.
  useEffect(() => {
    Appearance.setColorScheme(appearance === "system" ? "unspecified" : appearance);
  }, [appearance]);

  // Settings persist as they change, written on change only. A layout effect,
  // so it is subscribed before any screen's effect runs: Home marks the first
  // launch in its own first effect, and child effects run before a parent's.
  useLayoutEffect(() => {
    if (data === null) return;
    return useSettings.subscribe((now, before) => {
      if (now.appearance !== before.appearance) void saveSetting(data.user, "appearance", now.appearance);
      if (now.textScale !== before.textScale) void saveSetting(data.user, "textScale", String(now.textScale));
      if (now.translation !== before.translation) void saveSetting(data.user, "translation", now.translation);
      if (now.launched && !before.launched) void saveSetting(data.user, "launched", "1");
      if (now.hintSeen && !before.hintSeen) void saveSetting(data.user, "hintSeen", "1");
      if (now.evidenceHintSeen && !before.evidenceHintSeen) void saveSetting(data.user, "evidenceHintSeen", "1");
    });
  }, [data]);

  if (failure !== null || !fontsLoaded || data === null || reduceMotion === null) {
    // First launch copies ~85MB of bundles out of the app; later launches take
    // milliseconds. The splash covers this; only a failure is ever drawn here.
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.paper }}>
        {failure !== null ? (
          <Text style={{ marginTop: 16, paddingHorizontal: 32, color: palette.mutedInk, textAlign: "center" }}>
            The Bible text could not be opened. {failure}
          </Text>
        ) : null}
      </View>
    );
  }

  // Understand (depth 1) opens at the medium detent, so the verse stays visible
  // above it; at AX sizes it opens large (brief §3). The evidence sheet (depth 2)
  // stacks on it. Both are inset system sheets (ElevenReader, Claude in Mobbin).
  const sheet = {
    presentation: "formSheet" as const,
    sheetAllowedDetents: [SHEET_MEDIUM, 1],
    sheetInitialDetentIndex: ax ? 1 : 0,
    sheetGrabberVisible: true,
    sheetCornerRadius: 38,
    contentStyle: { backgroundColor: palette.sheet },
  };

  return (
    <SafeAreaProvider>
      <AppDataProvider value={data}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <LaunchStage reduceMotion={reduceMotion}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="read/[book]/[chapter]" />
          <Stack.Screen name="bookmarks" />
          <Stack.Screen name="recent" />
          <Stack.Screen name="sources" />
          <Stack.Screen name="thread" />
          <Stack.Screen name="understand" options={sheet} />
          <Stack.Screen name="evidence" options={sheet} />
          {/* Contents and Search open large: lists to scan, not notes beside the text. */}
          <Stack.Screen name="contents" options={{ ...sheet, sheetAllowedDetents: [1], sheetInitialDetentIndex: 0 }} />
          <Stack.Screen name="search" options={{ ...sheet, sheetAllowedDetents: [1], sheetInitialDetentIndex: 0 }} />
          <Stack.Screen
            name="type-settings"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: "fitToContents",
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: palette.sheet },
            }}
          />
        </Stack>
        </LaunchStage>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}

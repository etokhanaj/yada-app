/**
 * Root: fonts, bundles, the reader's settings, then the routes.
 *
 * Everything the reading surface needs is opened here, once, before any
 * screen renders — so no screen shows a loading state for its own data
 * (the design brief rules out skeletons in reading).
 */

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Appearance, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { type AppData, AppDataProvider } from "../data/AppData";
import { installBundles, openCore, openUser } from "../data/bundles";
import { loadSettings, saveSetting } from "../data/user";
import { FONTS, useIsDark, usePalette } from "../design/tokens";
import { useSettings } from "../state/settings";

async function start(): Promise<AppData> {
  const user = await openUser();
  await installBundles(user);
  const core = await openCore();
  useSettings.getState().hydrate(await loadSettings(user));
  return { core, user };
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Literata: require("../../assets/fonts/Literata.ttf"),
    GentiumPlus: require("../../assets/fonts/GentiumPlus-Regular.ttf"),
    NotoSerifHebrew: require("../../assets/fonts/NotoSerifHebrew.ttf"),
  });
  const [data, setData] = useState<AppData | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const appearance = useSettings((s) => s.appearance);
  const palette = usePalette();
  const isDark = useIsDark();

  useEffect(() => {
    start().then(setData, (error: unknown) => setFailure(String(error)));
  }, []);

  // Native sheets, the keyboard and system controls follow the reader's
  // choice, not only Yada's own views.
  useEffect(() => {
    Appearance.setColorScheme(appearance === "system" ? "unspecified" : appearance);
  }, [appearance]);

  // Settings persist as they change; three keys, written on change only.
  useEffect(() => {
    if (data === null) return;
    return useSettings.subscribe((now, before) => {
      if (now.appearance !== before.appearance) void saveSetting(data.user, "appearance", now.appearance);
      if (now.textScale !== before.textScale) void saveSetting(data.user, "textScale", String(now.textScale));
      if (now.translation !== before.translation) void saveSetting(data.user, "translation", now.translation);
    });
  }, [data]);

  if (!fontsLoaded || data === null) {
    // First launch copies ~85MB of bundles out of the app; later launches take
    // milliseconds. Plain paper and the name, nothing animated.
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.paper }}>
        {fontsLoaded ? (
          <Text style={{ fontFamily: FONTS.scripture, fontSize: 28, color: palette.mutedInk }}>Yada</Text>
        ) : null}
        {failure !== null ? (
          <Text style={{ marginTop: 16, paddingHorizontal: 32, color: palette.mutedInk, textAlign: "center" }}>
            The Bible text could not be opened. {failure}
          </Text>
        ) : null}
      </View>
    );
  }

  const sheet = { presentation: "modal" as const, contentStyle: { backgroundColor: palette.paper } };

  return (
    <SafeAreaProvider>
      <AppDataProvider value={data}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="read/[book]/[chapter]" />
          <Stack.Screen name="search" />
          <Stack.Screen name="bookmarks" />
          <Stack.Screen name="explored" />
          <Stack.Screen name="library" />
          <Stack.Screen name="thread" />
          <Stack.Screen name="understand" options={sheet} />
          <Stack.Screen name="original" options={sheet} />
          <Stack.Screen name="compare" options={sheet} />
          <Stack.Screen name="why" options={sheet} />
          <Stack.Screen name="occurrences" options={sheet} />
          {/*
            The word card opens part-height, the iOS Look Up shape, and drags or
            scrolls up to full height — it must scroll at accessibility sizes.
            SheetScreen's partHeight layout is what keeps it from rendering empty.
          */}
          <Stack.Screen
            name="word"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.55, 1],
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: palette.paper },
            }}
          />
          <Stack.Screen
            name="type-settings"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: "fitToContents",
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: palette.paper },
            }}
          />
        </Stack>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}

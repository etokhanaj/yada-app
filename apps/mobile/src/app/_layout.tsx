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
import { AccessibilityInfo, AppState, Appearance, LogBox, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LaunchStage } from "../components/LaunchOverlay";
import { type AppData, AppDataProvider, asDb } from "../data/AppData";
import { initAudio } from "../data/audio";
import { countListening } from "../data/rhythm";
import { installBundles, openCore, openUser } from "../data/bundles";
import { setCloudPaused, startCloudSync } from "../data/cloud";
import { refreshReminder, targetOf } from "../data/reminder";
import { followListening, indexSpotlight, updateWidgets, watchDoors } from "../data/system";
import { listen } from "../data/audio";
import { openFromOutside } from "../components/navigation";
import * as Notifications from "expo-notifications";
import { registerPassageNoteSource } from "../data/passageNote";
import { openInstalledStudy, passageNoteSource } from "../data/study";
import { openInstalledTranslations, useTranslations } from "../data/translations";
import { openInstalledUnderstand } from "../data/understand";
import { pruneLicensedCache } from "../data/licensed";
import { licensedCodes, licensedEnabled, loadLicensedCodes, registerLicensedProvider } from "../data/useLicensedChapter";
import { loadSettings, saveSetting } from "../data/user";
import { SHEET_MEDIUM, useAXLevel, useIsDark, usePalette } from "../design/tokens";
import { useReduceMotion } from "../lib/motion";
import { watchAccessibility } from "../state/accessibility";
import { useSettings } from "../state/settings";

// The splash (brief §8.16) stays until LaunchStage draws its copy, which then
// lifts away once the first screen is ready (§8.17).
void SplashScreen.preventAutoHideAsync();

async function start(): Promise<AppData> {
  const user = await openUser();
  await installBundles(user);
  const core = await openCore();
  // Downloads attach before settings hydrate, so a reader of YLT reopens in YLT.
  const installed = await openInstalledTranslations(core, user).catch(() => []);
  // Study notes are an extra: a launch whose study pass fails still reads.
  await openInstalledStudy(user).catch(() => undefined);
  // Understand is read from its own per-book files (docs/no-ai-understand.md); John's ships.
  await openInstalledUnderstand(user).catch(() => undefined);
  // Every John passage without a reviewed Yada entry opens its guide on Tyndale's note (build plan,
  // "Content the guide can show before the John batch").
  registerPassageNoteSource(passageNoteSource);
  // A licensed version is readable only through the proxy, or the dev flag, and only while it is
  // served (NIV is not, 12 Oct 2026), so only then does a saved one survive hydrate; anywhere else
  // it falls back to BSB.
  const licensed = registerLicensedProvider(await loadLicensedCodes(user).catch(() => []));
  // API.Bible §11 and §18.8: nothing past 30 days, nothing of a version no longer served, and
  // nothing at all in a build that offers none.
  await pruneLicensedCache(user, licensedEnabled(), new Date(), licensed);
  // Merged with iCloud before settings hydrate and Home reads the reading place, so a
  // second device opens where the first left off. It never fails the launch.
  // Settings › iCloud off (ST-01) holds on this device only: it is not a synced setting.
  setCloudPaused((await loadSettings(user))["icloud"] === "off");
  await startCloudSync(user, () => void followCloudSettings(user)).catch(() => undefined);
  const stored = await loadSettings(user);
  useSettings.getState().hydrate(stored, [...installed, ...licensed]);
  // After hydrate, so the restored translation is not taken for a switch made while playing.
  initAudio(core, user, stored);
  countListening(user);
  // The reminder's two weeks are made again from today's progress (lib/reminder.ts); never fails the launch.
  void refreshReminder(user, asDb(core)).catch(() => undefined);
  return { core, user };
}

/** A setting changed on another device: the store follows user.db, keeping a translation not installed here. */
async function followCloudSettings(user: AppData["user"]): Promise<void> {
  const installed = useTranslations.getState().installed.map((t) => t.code);
  // The served set as it is now: the proxy may have named a new one since launch.
  useSettings.getState().hydrate(await loadSettings(user), [...installed, ...licensedCodes()], useSettings.getState().translation);
}


// An unsigned simulator build has no keychain entitlement, so expo-notifications' read of its push registration
// fails on every launch; Yada sends no push. Its red dev banner covered the reader's bar and broke the Maestro
// flows (15 Oct 2026). Development only: LogBox does not exist in release builds.
LogBox.ignoreLogs(["[expo-notifications] Error reading persisted server registration info"]);

// A reminder due while Yada is open goes to Notification Center without a banner: the reader is already here,
// and without a handler iOS dropped it unseen (John, 15 Oct 2026: "how come I never get notifications").
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Literata: require("../../assets/fonts/Literata.ttf"),
    LiterataItalic: require("../../assets/fonts/Literata-Italic.ttf"),
    GentiumPlus: require("../../assets/fonts/GentiumPlus-Regular.ttf"),
    NotoSerifHebrew: require("../../assets/fonts/NotoSerifHebrew.ttf"),
  });
  const [data, setData] = useState<AppData | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [launchAttempt, setLaunchAttempt] = useState(0);
  const appearance = useSettings((s) => s.appearance);
  const palette = usePalette();
  const isDark = useIsDark();
  const ax = useAXLevel() >= 1;
  // Live, from the store: the toggle can change while the app runs, and the
  // next sheet presented should follow it.
  const sheetsFade = useReduceMotion();
  const understandFull = useSettings((s) => s.understandFull || s.understandOpenFull);

  useEffect(() => {
    start().then(setData, (error: unknown) => {
      // US-10: the reader sees plain words; the exception is for the developer only.
      if (__DEV__) console.warn("launch failed", error);
      setFailure(String(error));
    });
  }, [launchAttempt]);

  useEffect(watchAccessibility, []);

  // A tapped reminder lands where it says (IA-13): the next passage's guide, the plan's portion or the
  // day's psalm; its long-press Listen starts reading there in the BSB (NT-05). Once the data is open.
  useEffect(() => {
    if (data === null) return;
    // Each response once: the last-response call and the listener can both deliver it on a cold launch,
    // and Home's own open-at-the-place may have pushed a reader already (review, 13 Oct 2026).
    const handled = new Set<string>();
    const open = (response: Notifications.NotificationResponse | null) => {
      if (response === null) return;
      const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.has(id)) return;
      handled.add(id);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      const target = targetOf(response.notification.request.content.data);
      if (target === null) return;
      if (response.actionIdentifier === "listen") void listen(target.book, target.chapter, target.verse);
      openFromOutside({ book: target.book, chapter: target.chapter, verse: target.verse, resume: true, ...(target.guide === undefined ? {} : { guide: target.guide }) });
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    // Siri, App Shortcuts and Spotlight (MS-02, MS-03), and the Live Activity (WL-02, WL-03).
    const doors = watchDoors(data.user);
    const listening = followListening();
    void updateWidgets(data.user, data.core).catch(() => undefined);
    // After the first screens have what they need: thirty thousand verses are no launch task.
    const indexing = setTimeout(() => void indexSpotlight(data.user, data.core).catch(() => undefined), 5000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshReminder(data.user, data.core).catch(() => undefined);
      // Leaving the app: the widget's Continue becomes where the reader stopped (WL-01).
      if (state === "background") void updateWidgets(data.user, data.core).catch(() => undefined);
    });
    return () => {
      sub.remove();
      doors();
      listening();
      clearTimeout(indexing);
      appState.remove();
    };
  }, [data]);

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
      if (now.compareWith !== before.compareWith) void saveSetting(data.user, "compareWith", (now.compareWith ?? []).join(","));
      if (now.launched && !before.launched) void saveSetting(data.user, "launched", "1");
      if (now.hintSeen && !before.hintSeen) void saveSetting(data.user, "hintSeen", "1");
      if (now.evidenceHintSeen && !before.evidenceHintSeen) void saveSetting(data.user, "evidenceHintSeen", "1");
      if (now.understandFull !== before.understandFull) void saveSetting(data.user, "understandFull", now.understandFull ? "1" : "0");
      if (now.psalmTipSeen && !before.psalmTipSeen) void saveSetting(data.user, "psalmTipSeen", "1");
      if (now.understandOpenFull !== before.understandOpenFull) void saveSetting(data.user, "understandOpenFull", now.understandOpenFull ? "1" : "0");
    });
  }, [data]);

  if (failure !== null || !fontsLoaded || data === null || reduceMotion === null) {
    // First launch copies ~85MB of bundles out of the app; later launches take
    // milliseconds. The splash covers this; only a failure is ever drawn here.
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.paper }}>
        {failure !== null ? (
          // US-10: plain words, Try again, no error code.
          <View style={{ paddingHorizontal: 32, rowGap: 8, alignItems: "center" }} testID="launch-failed">
            <Text style={{ color: palette.ink, fontSize: 17, fontWeight: "600", textAlign: "center" }} accessibilityRole="header">
              Yada couldn’t open the Bible text.
            </Text>
            <Text style={{ color: palette.mutedInk, fontSize: 15, textAlign: "center" }}>If this keeps happening, close Yada and open it again.</Text>
            <Pressable
              onPress={() => {
                setFailure(null);
                setLaunchAttempt((n) => n + 1);
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({ marginTop: 12, minHeight: 44, paddingHorizontal: 20, borderRadius: 999, justifyContent: "center", backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 })}
              testID="launch-retry"
            >
              <Text style={{ color: palette.ink, fontSize: 16, fontWeight: "600" }}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  // Understand (depth 1) opens at the medium detent, so the verse stays visible
  // above it; at AX sizes it opens large (brief §3). The evidence sheet (depth 2)
  // stacks on it. Both are inset system sheets (ElevenReader, Claude in Mobbin).
  //
  // Reduce Motion (brief §5: "Sheets present and change detent with a
  // cross-fade, no slide or spring"). `animation: "fade"` reaches
  // react-native-screens as stackAnimation "fade", which on iOS sets the
  // controller's modalTransitionStyle to UIModalTransitionStyleCrossDissolve
  // (RNSScreen.mm setStackAnimation:), so present and dismiss cross-fade
  // instead of sliding up. Detent changes cannot follow: react-native-screens
  // 4.26 always wraps them in UISheetPresentationController.animateChanges
  // (RNSScreen.mm updateFormSheetPresentationStyle, animate:YES), and a drag
  // between detents is UIKit's own interactive spring, with no option exposed.
  // Read from the library source; not yet watched on a device.
  const sheetAnimation = sheetsFade ? ("fade" as const) : ("default" as const);
  const sheet = {
    presentation: "formSheet" as const,
    animation: sheetAnimation,
    sheetAllowedDetents: [SHEET_MEDIUM, 1],
    sheetInitialDetentIndex: ax ? 1 : 0,
    sheetGrabberVisible: true,
    sheetCornerRadius: 38,
    contentStyle: { backgroundColor: palette.sheet },
  };

  return (
    // The chapter swipe (SW-01) needs gesture handling from the root.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <AppDataProvider value={data}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <LaunchStage reduceMotion={reduceMotion}>
        {/* Reduce Motion: pushed pages fade rather than slide, as the sheets already do (QA, 13 Oct 2026). */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper }, animation: sheetsFade ? "fade" : "default" }}>
          {/* IA v4: Today and Bible are tabs beneath every other route (build 7). */}
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="read/[book]/[chapter]" />
          <Stack.Screen name="bookmarks" />
          <Stack.Screen name="recent" />
          <Stack.Screen name="sources" />
          <Stack.Screen name="thread" />
          <Stack.Screen name="plans" />
          <Stack.Screen name="mcheyne" />
          <Stack.Screen name="reminder" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="downloads" />
          <Stack.Screen name="devotional" />
          {/* A widget's link (navigation.ts openHref): it hands over at once, so nothing animates. */}
          <Stack.Screen name="open" options={{ animation: "none" }} />
          {/* The full player (AU-04) covers the reader; closed by its down chevron, so no swipe to lose. */}
          <Stack.Screen
            name="player"
            options={{ presentation: "fullScreenModal", animation: sheetsFade ? "fade" : "slide_from_bottom", gestureEnabled: false }}
          />
          {/* The verse sheet reopens at the height last chosen, or full when Settings says so (Phase 1, VS-01/02). */}
          {/* The Voice sheet over the full player (BA-03): medium, large at AX sizes. A ScrollView-filled sheet has no height of its own to fit. */}
          <Stack.Screen
            name="voice"
            options={{ ...sheet, sheetAllowedDetents: ax ? [1] : [SHEET_MEDIUM], sheetInitialDetentIndex: 0 }}
          />
          <Stack.Screen name="understand" options={{ ...sheet, sheetInitialDetentIndex: ax || understandFull ? 1 : 0 }} />
          {/* The passage guide: medium and large, as Understand (PG-02, PG-03). */}
          <Stack.Screen name="guide" options={sheet} />
          {/* NP-01: the reminder asked for at the first passage's end, at the medium height only. */}
          <Stack.Screen name="remind-ask" options={{ ...sheet, sheetAllowedDetents: ax ? [1] : [SHEET_MEDIUM], sheetInitialDetentIndex: 0 }} />
          <Stack.Screen name="rhythm" options={{ ...sheet, sheetAllowedDetents: ax ? [1] : [SHEET_MEDIUM], sheetInitialDetentIndex: 0 }} />
          <Stack.Screen name="evidence" options={sheet} />
          {/* Contents and Search open large: lists to scan, not notes beside the text. */}
          <Stack.Screen name="contents" options={{ ...sheet, sheetAllowedDetents: [1], sheetInitialDetentIndex: 0 }} />
          <Stack.Screen name="search" options={{ ...sheet, sheetAllowedDetents: [1], sheetInitialDetentIndex: 0 }} />
          {/* Translations (MT-02), opened from Contents' Translation row: a list to scan, so large too. */}
          <Stack.Screen name="translations" options={{ ...sheet, sheetAllowedDetents: [1], sheetInitialDetentIndex: 0 }} />
          <Stack.Screen
            name="type-settings"
            options={{
              presentation: "formSheet",
              animation: sheetAnimation,
              sheetAllowedDetents: "fitToContents",
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: palette.sheet },
            }}
          />
        </Stack>
        </LaunchStage>
      </AppDataProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

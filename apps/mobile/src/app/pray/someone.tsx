/**
 * Pray for someone (PR-09, XT-03): a calm full screen, the request alone in Literata with who asked and when, and at the
 * foot a pill that fills while you hold, about 20 s ("Keep holding" while it does), or a timer that fills it for you.
 * Then "Prayed" and the next. One you prayed for never comes round again; with none left, it says so plainly and offers
 * Ask for prayer or Back to Pray (XT-03). × ends it;
 * ⋯ holds Report and Block (App Store guideline 1.2). It was a list page with a large title (design QA, 18 Oct 2026).
 */

import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type PrayerRequest, prayCloud } from "../../../modules/yada-pray";
import { Icon } from "../../components/Icon";
import { Chrome } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { block, loadPrayLocal, markPrayed } from "../../data/prayLocal";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { askedLine, HOLD_SECONDS, offerable } from "../../lib/pray";

export default function PrayForSomeone() {
  const { user } = useAppData();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { gutter, pill } = useLayout();
  const [queue, setQueue] = useState<PrayerRequest[] | null>(null);
  const fill = useRef(new Animated.Value(0)).current;
  // How far the pill has filled, so a second hold carries on from there rather than starting again.
  const filled = useRef(0);
  useEffect(() => {
    const id = fill.addListener(({ value }) => {
      filled.current = value;
    });
    return () => fill.removeListener(id);
  }, [fill]);
  const [holding, setHolding] = useState<"hold" | "timer" | null>(null);
  const [prayed, setPrayed] = useState(false);

  const load = useCallback(async () => {
    if (prayCloud === null) return setQueue([]);
    const local = await loadPrayLocal(user);
    const open = await prayCloud.open([...local.prayed, ...local.blocked], 10).catch(() => []);
    setQueue(offerable(open, local.prayed, local.blocked));
  }, [user]);
  useEffect(() => void load(), [load]);

  // An abandoned prayer must never be marked prayed: × mid-timer unmounts the screen, so the animation is stopped and
  // done() checks the screen is still here (code review, 18 Oct 2026).
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
      fill.stopAnimation();
    },
    [fill],
  );

  const request = queue?.[0];
  const done = useCallback(async () => {
    if (request === undefined || !live.current) return;
    setHolding(null);
    setPrayed(true);
    await prayCloud?.prayed(request.id).catch(() => undefined);
    await markPrayed(user, request.id);
  }, [request, user]);

  const start = (how: "hold" | "timer") => {
    setHolding(how);
    Animated.timing(fill, { toValue: 1, duration: HOLD_SECONDS * 1000 * (1 - filled.current), easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (finished) void done();
    });
  };
  const release = () => {
    if (prayed || holding !== "hold") return;
    setHolding(null);
    fill.stopAnimation();
    Animated.timing(fill, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  };
  const next = () => {
    fill.setValue(0);
    setPrayed(false);
    setQueue((q) => (q === null ? q : q.slice(1)));
  };
  const more = () => {
    if (request === undefined) return;
    ActionSheetIOS.showActionSheetWithOptions({ options: ["Report", "Block this person", "Cancel"], destructiveButtonIndex: [0, 1], cancelButtonIndex: 2 }, (i) => {
      // A failed report or block said nothing and kept the request up (code review, 18 Oct 2026).
      if (i === 0) void prayCloud?.report(request.id, "reported").then(next).catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t report it. Try again."));
      if (i === 1) void block(user, request.creator).then(next).catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t block them. Try again."));
    });
  };

  const round = (icon: "close" | "more", label: string, onPress: () => void, testID: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.round, { backgroundColor: palette.fill }]} testID={testID}>
      <Icon name={icon} size={20} />
    </Pressable>
  );
  const asked = request === undefined ? null : askedLine(request.firstName, request.createdAt, Date.now());

  return (
    <View style={[styles.root, { backgroundColor: palette.paper, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 16, paddingHorizontal: gutter }]} testID="pray-someone">
      <View style={styles.top}>
        {round("close", "Close, back to Pray", () => router.back(), "pray-close")}
        {request !== undefined ? round("more", "More: Report or Block", more, "pray-more") : null}
      </View>
      <View style={styles.middle}>
        {queue === null ? null : request === undefined ? (
          <View style={{ rowGap: 8 }} testID="pray-none">
            <Text style={[styles.request, { color: palette.ink }]}>That’s everyone for now.</Text>
            <Chrome step="note" tone="muted" style={{ textAlign: "center" }}>
              New requests come in through the day.
            </Chrome>
          </View>
        ) : (
          <View style={{ rowGap: 10 }}>
            <Text style={[styles.request, { color: palette.ink }]} maxFontSizeMultiplier={1.8}>
              {request.text}
            </Text>
            {asked === null ? null : (
              <Chrome step="note" tone="muted" style={{ textAlign: "center" }}>
                {asked}
              </Chrome>
            )}
          </View>
        )}
      </View>
      {queue === null ? null : request === undefined ? (
        // XT-03: with no one left, the way on is to ask, or back to Pray.
        <View style={{ rowGap: 12, alignItems: "center" }}>
          <Pressable
            onPress={() => {
              router.back();
              router.push("/pray/ask");
            }}
            accessibilityRole="button"
            style={[styles.hold, { minHeight: pill, backgroundColor: palette.ink }]}
            testID="pray-none-ask"
          >
            <Chrome style={{ color: palette.paper, fontWeight: "600" }}>Ask for prayer</Chrome>
          </Pressable>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={[styles.timer, { backgroundColor: palette.fill }]} testID="pray-none-back">
            <Chrome step="note" tone="ink" style={{ fontWeight: "600" }}>
              Back to Pray
            </Chrome>
          </Pressable>
        </View>
      ) : prayed ? (
        <View style={{ rowGap: 12, alignItems: "stretch" }}>
          <Chrome tone="accent" style={styles.prayedMark} accessibilityLiveRegion="polite">
            ✓ Prayed
          </Chrome>
          <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Next request" style={[styles.hold, { minHeight: pill, backgroundColor: palette.ink }]} testID="pray-next">
            <Chrome style={{ color: palette.paper, fontWeight: "600" }}>Next request</Chrome>
          </Pressable>
        </View>
      ) : (
        <View style={{ rowGap: 12, alignItems: "center" }}>
          <Pressable
            onPressIn={() => start("hold")}
            onPressOut={release}
            disabled={holding === "timer"}
            accessibilityRole="button"
            accessibilityLabel={`Hold to pray, about ${HOLD_SECONDS} seconds`}
            accessibilityHint="Or use a timer instead"
            style={[styles.hold, { minHeight: pill, backgroundColor: palette.fill }]}
            testID="pray-hold"
          >
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.ink, opacity: 0.16, width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
            <Chrome tone="ink" style={{ fontWeight: "600" }}>
              {holding === "hold" ? "Keep holding" : holding === "timer" ? "Praying…" : "Hold to pray"}
            </Chrome>
          </Pressable>
          {holding === null ? (
            <Pressable onPress={() => start("timer")} accessibilityRole="button" accessibilityLabel={`Use a timer instead of holding, ${HOLD_SECONDS} seconds`} style={[styles.timer, { backgroundColor: palette.fill }]} testID="pray-timer">
              <Chrome step="note" tone="ink" style={{ fontWeight: "600" }}>
                Use a timer instead
              </Chrome>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  middle: { flex: 1, justifyContent: "center", paddingHorizontal: 8 },
  request: { fontFamily: FONTS.scripture, fontSize: 24, lineHeight: 33, textAlign: "center" },
  hold: { alignSelf: "stretch", borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  timer: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: "center" },
  prayedMark: { textAlign: "center", fontSize: 15, fontWeight: "600" },
});

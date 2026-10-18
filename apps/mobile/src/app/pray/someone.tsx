/**
 * Pray for someone (PR-09, XT-03): the request alone; a pill at the foot fills while you hold, about 20 s, or a timer
 * fills it for you. Then the next. One you prayed for never comes round again; with none left, it says so plainly.
 * ⋯ holds Report and Block (App Store guideline 1.2).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionSheetIOS, Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { type PrayerRequest, prayCloud } from "../../../modules/yada-pray";
import { PageScreen } from "../../components/Page";
import { Chrome, Prose } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { block, loadPrayLocal, markPrayed } from "../../data/prayLocal";
import { usePalette } from "../../design/tokens";
import { HOLD_SECONDS, offerable } from "../../lib/pray";

export default function PrayForSomeone() {
  const { user } = useAppData();
  const palette = usePalette();
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
  const [prayed, setPrayed] = useState(false);

  const load = useCallback(async () => {
    if (prayCloud === null) return setQueue([]);
    const local = await loadPrayLocal(user);
    const open = await prayCloud.open([...local.prayed, ...local.blocked], 10).catch(() => []);
    setQueue(offerable(open, local.prayed, local.blocked));
  }, [user]);
  useEffect(() => void load(), [load]);

  const request = queue?.[0];
  const done = useCallback(async () => {
    if (request === undefined) return;
    setPrayed(true);
    await prayCloud?.prayed(request.id).catch(() => undefined);
    await markPrayed(user, request.id);
  }, [request, user]);

  const hold = (seconds: number) =>
    Animated.timing(fill, { toValue: 1, duration: seconds * 1000 * (1 - filled.current), easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (finished) void done();
    });
  const release = () => {
    if (prayed) return;
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
      if (i === 0) void prayCloud?.report(request.id, "reported").then(next);
      if (i === 1) void block(user, request.creator).then(next);
    });
  };

  if (queue !== null && request === undefined)
    return (
      <PageScreen title="Pray for someone" back="Pray" testID="pray-none">
        <Prose step="claim">That’s everyone for now.</Prose>
        <Chrome tone="muted" step="note" style={{ marginTop: 6 }}>
          New requests come in through the day.
        </Chrome>
      </PageScreen>
    );

  return (
    <PageScreen title="Pray for someone" back="Pray" right={request !== undefined ? <Pressable onPress={more} accessibilityRole="button" accessibilityLabel="More: Report or Block" hitSlop={12}><Chrome tone="ink">⋯</Chrome></Pressable> : undefined} testID="pray-someone">
      {request !== undefined ? (
        <View style={{ rowGap: 24 }}>
          <View>
            <Prose step="claim">{request.text}</Prose>
            {request.firstName !== "" ? (
              <Chrome tone="muted" step="note" style={{ marginTop: 8 }}>
                {request.firstName}
              </Chrome>
            ) : null}
          </View>
          {prayed ? (
            <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Prayed. Next request" style={[styles.pill, { backgroundColor: palette.ink }]} testID="pray-next">
              <Chrome style={{ color: palette.paper, fontWeight: "600" }}>Prayed · Next</Chrome>
            </Pressable>
          ) : (
            <View style={{ rowGap: 12 }}>
              <Pressable onPressIn={() => hold(HOLD_SECONDS)} onPressOut={release} accessibilityRole="button" accessibilityLabel="Hold to pray, about 20 seconds" style={[styles.pill, { backgroundColor: palette.card, overflow: "hidden" }]} testID="pray-hold">
                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.accent, opacity: 0.25, width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
                <Chrome tone="ink" style={{ fontWeight: "600" }}>
                  Hold to pray
                </Chrome>
              </Pressable>
              <Pressable onPress={() => hold(HOLD_SECONDS)} accessibilityRole="button" accessibilityLabel="Use a timer instead of holding" hitSlop={8} testID="pray-timer">
                <Chrome tone="muted" step="note" style={{ textAlign: "center" }}>
                  Use a timer
                </Chrome>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  pill: { minHeight: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});

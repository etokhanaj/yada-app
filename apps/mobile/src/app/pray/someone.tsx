/**
 * Pray for someone (PR-09, XT-03; Build 12 PR-60, approved by John 25 Oct 2026): the day's picture, blurred, as Sit and
 * Asked are; who asked and when, the request large in Literata, what they will see, and at the foot a white pill that
 * fills while you hold, about 20 s ("Keep holding" while it does), or a timer that fills it for you.
 * Then "Prayed" and the next. One you prayed for never comes round again; with none left, it says so plainly and offers
 * Ask for prayer or Back to Pray (XT-03). × ends it;
 * ⋯ holds Report and Block (App Store guideline 1.2). It was a list page with a large title (design QA, 18 Oct 2026).
 * After Prayed, one quiet link sets a reminder to pray for it again tomorrow (PA-01); a tapped reminder opens here with
 * that request first, though you have prayed for it. Opened from a circle (PC-20), it holds that one request, says the
 * circle's name under it, and ends with Back to the circle.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { circlesCloud, type PrayerRequest, prayCloud } from "../../../modules/yada-pray";
import { GlassButton } from "../../components/Glass";
import { Icon } from "../../components/Icon";
import { PictureGround } from "../../components/PictureGround";
import { Pill } from "../../components/Pill";
import { Chrome } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { block, loadPrayLocal, markPrayed } from "../../data/prayLocal";
import { loadPrayNotify, prayAgain, watchAnswer } from "../../data/prayNotify";
import { BRAND, ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout } from "../../design/tokens";
import { askedLine, HOLD_SECONDS, offerable, prayAgainLine } from "../../lib/pray";

export default function PrayForSomeone() {
  const { user } = useAppData();
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
  const { again, circle, owner = "", name = "", request: circleRequest } = useLocalSearchParams<{ again?: string; circle?: string; owner?: string; name?: string; request?: string }>();
  const inCircle = circle !== undefined && circleRequest !== undefined;
  const [againOn, setAgainOn] = useState(false);
  const [againAt, setAgainAt] = useState<Date | null>(null);
  useEffect(() => void loadPrayNotify(user).then((p) => setAgainOn(p.again)), [user]);

  const load = useCallback(async () => {
    if (inCircle) {
      const all = (await circlesCloud?.requests(circle, owner).catch(() => [])) ?? [];
      return setQueue(all.filter((r) => r.id === circleRequest).map((r) => ({ id: r.id, text: r.text, firstName: r.firstName, creator: r.creator, expiresAt: r.expiresAt })));
    }
    if (prayCloud === null) return setQueue([]);
    const local = await loadPrayLocal(user);
    const open = await prayCloud.open([...local.prayed, ...local.blocked], 10).catch(() => []);
    const first = again === undefined ? [] : await prayCloud.fetch([again]).catch(() => []);
    const now = Date.now();
    // An answered one (PC-23) is shown alone, to read; a live one (PA-01) comes first, then the rest.
    const held = first[0];
    if (held?.answeredAt !== undefined) return setQueue([held]);
    setQueue([...first.filter((r) => r.expiresAt > now), ...offerable(open, local.prayed, local.blocked)]);
  }, [user, again, inCircle, circle, owner, circleRequest]);
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
    if (inCircle) {
      await circlesCloud?.prayed(circle, owner, request.id).catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t mark it prayed. Try again."));
      // Kept here too, so the circle's cover on Pray stops counting it as new (PT-46).
      await markPrayed(user, request.id).catch(() => undefined);
      return;
    }
    await prayCloud?.prayed(request.id).catch(() => undefined);
    await markPrayed(user, request.id);
    await watchAnswer(user, request.id).catch(() => undefined);
  }, [request, user, inCircle, circle, owner]);

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
    setAgainAt(null);
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

  const asked = request === undefined ? null : askedLine("", request.createdAt, Date.now());
  const who = request === undefined ? "" : inCircle ? [request.firstName, name].filter((x) => x !== "").join(" · ") : ["Someone on Yada", request.firstName].filter((x) => x !== "").join(" · ");
  const back = inCircle ? `Back to ${name}` : "Back to Pray";
  const seen = request === undefined || inCircle ? null : `${request.firstName === "" ? "They see" : `${request.firstName} sees`} that one more person prayed. Never who.`;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 16 }]} testID="pray-someone">
      <PictureGround blurred />
      <View style={[styles.top, { paddingHorizontal: gutter - 8 }]}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel={`Close, ${back.charAt(0).toLowerCase()}${back.slice(1)}`} testID="pray-close">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
        {request !== undefined && request.answeredAt === undefined && !inCircle ? (
          <GlassButton onPicture onPress={more} accessibilityLabel="More: Report or Block" testID="pray-more">
            <Icon name="more" size={20} tone="white" />
          </GlassButton>
        ) : null}
      </View>
      {/* Scrolls at AX sizes, so a long request never runs under the controls (12h QA, AX5). */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.middle, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        {queue === null ? null : request === undefined ? (
          <View style={{ rowGap: 8 }} testID="pray-none">
            <Text style={styles.request} maxFontSizeMultiplier={1.4}>That’s everyone for now.</Text>
            <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
              New requests come in through the day.
            </Chrome>
          </View>
        ) : (
          <>
            <View style={styles.who}>
              <View style={styles.where}>
                <Icon name={inCircle ? "people" : "globe"} size={18} tone="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>{who}</Chrome>
                {asked === null ? null : (
                  <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
                    {`Asked ${asked.toLowerCase()}`}
                  </Chrome>
                )}
              </View>
            </View>
            <Text style={styles.request} maxFontSizeMultiplier={1.4} accessibilityRole="header">
              {request.text}
            </Text>
            {seen === null || request.answeredAt !== undefined ? null : (
              <Chrome step="note" style={{ color: ON_PICTURE.muted }}>
                {seen}
              </Chrome>
            )}
          </>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter }}>
        {queue === null ? null : request === undefined ? (
          // XT-03: with no one left, the way on is to ask, or back to Pray.
          <View style={{ rowGap: 8 }}>
            <Pill
              title="Ask for prayer"
              onPicture
              stretch
              onPress={() => {
                router.back();
                router.push("/pray/ask");
              }}
              testID="pray-none-ask"
            />
            <GlassButton shape="capsule" onPicture onPress={() => router.back()} style={styles.second} testID="pray-none-back">
              <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>Back to Pray</Chrome>
            </GlassButton>
          </View>
        ) : request.answeredAt !== undefined ? (
          <View style={{ rowGap: 12 }}>
            <Chrome style={styles.mark}>Answered · you prayed for it</Chrome>
            <Pill title="Back to Pray" onPicture stretch onPress={() => router.back()} testID="pray-answered-back" />
          </View>
        ) : prayed ? (
          <View style={{ rowGap: 8 }}>
            <Chrome style={styles.mark} accessibilityLiveRegion="polite">
              Prayed
            </Chrome>
            <Pill title={inCircle ? back : "Next request"} onPicture stretch onPress={inCircle ? () => router.back() : next} testID="pray-next" />
            {inCircle ? null : againAt !== null ? (
              <Chrome step="note" style={{ color: ON_PICTURE.muted, textAlign: "center" }} accessibilityLiveRegion="polite" testID="pray-again-set">
                {prayAgainLine(againAt)}
              </Chrome>
            ) : againOn ? (
              <Pressable
                onPress={() =>
                  void prayAgain(user, request.id)
                    .then((at) => (at === null ? AccessibilityInfo.announceForAccessibility("Notifications are off for Yada in iPhone Settings.") : setAgainAt(at)))
                    .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t set the reminder. Try again."))
                }
                accessibilityRole="button"
                hitSlop={8}
                style={styles.again}
                testID="pray-again"
              >
                <Chrome step="note" style={{ color: ON_PICTURE.text, fontWeight: "600" }}>
                  Pray again tomorrow
                </Chrome>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ rowGap: 8 }}>
            {/* PR-60: a white pill that fills with ink while you hold, as Sit's Begin is white on the picture. */}
            <Pressable
              onPressIn={() => start("hold")}
              onPressOut={release}
              disabled={holding === "timer"}
              accessibilityRole="button"
              accessibilityLabel={`Hold while you pray, about ${HOLD_SECONDS} seconds`}
              accessibilityHint="Or use a timer instead"
              style={[styles.hold, { minHeight: pill }]}
              testID="pray-hold"
            >
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: BRAND.ink, opacity: 0.14, width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
              <Chrome style={{ color: BRAND.ink, fontWeight: "600" }}>{holding === "hold" ? "Keep holding" : holding === "timer" ? "Praying…" : "Hold while you pray"}</Chrome>
            </Pressable>
            {holding === null ? (
              <GlassButton shape="capsule" onPicture onPress={() => start("timer")} accessibilityLabel={`Use a timer instead of holding, ${HOLD_SECONDS} seconds`} style={styles.second} testID="pray-timer">
                <Chrome style={{ color: ON_PICTURE.text, fontWeight: "600" }}>Use a timer instead</Chrome>
              </GlassButton>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  middle: { flexGrow: 1, justifyContent: "center", rowGap: 16, paddingVertical: 16 },
  who: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  where: { width: 36, height: 36, borderRadius: 18, backgroundColor: ON_PICTURE.glass, alignItems: "center", justifyContent: "center" },
  request: { color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontSize: 30, lineHeight: 39, letterSpacing: -0.3 },
  hold: { alignSelf: "stretch", borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: ON_PICTURE.text },
  second: { alignSelf: "stretch", minHeight: 48, justifyContent: "center" },
  again: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
  mark: { color: ON_PICTURE.text, textAlign: "center", fontWeight: "600" },
});

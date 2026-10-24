/**
 * A short line over the foot of the page (PC-11 "Removed from your list · Undo", PC-24 "Invite sent"): ink on paper's
 * opposite, one optional action, gone after five seconds. VoiceOver hears it once.
 */

import { useEffect, useRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";

import { BRAND } from "../design/palette";
import { useIsDark, usePalette } from "../design/tokens";
import { useTabBarClearance } from "./TabBar";
import { Chrome } from "./Type";

export function Toast({ text, action, onAction, onDone }: { text: string; action?: string; onAction?: () => void; onDone: () => void }) {
  const palette = usePalette();
  const dark = useIsDark();
  const clearance = useTabBarClearance();
  // Callers pass onDone inline, so it is new on every render: held in a ref, a re-render no longer restarts the five
  // seconds or announces the toast again (simulator QA, 18 Oct 2026).
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(action === undefined ? text : `${text}. ${action} is available.`);
    const t = setTimeout(() => done.current(), 5000);
    return () => clearTimeout(t);
  }, [text, action]);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: clearance - 8 }]}>
      <View style={[styles.toast, { backgroundColor: palette.ink }]} accessibilityRole="alert">
        <Chrome style={{ color: palette.paper, flex: 1 }}>{text}</Chrome>
        {action !== undefined && onAction !== undefined ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8} style={styles.action} testID="toast-action">
            <Chrome style={{ fontWeight: "600", color: dark ? BRAND.forest : BRAND.chartreuse }}>{action}</Chrome>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 10 },
  toast: { minHeight: 54, borderRadius: 18, flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 6 },
  action: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center" },
});

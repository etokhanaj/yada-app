/**
 * The segments across the top of a step-by-step screen on a picture: Sit's session (SW-03), the office (OF-30), Pray for
 * others (PF-31) and a Bible prayer (BP-31) each drew their own copy (12e design-system pass). One segment per step,
 * each filled from 0 to 1; read by VoiceOver as one progress bar with its own label.
 */

import { StyleSheet, View } from "react-native";

import { ON_PICTURE } from "../design/palette";

export function StepSegments({ count, fill, label }: { count: number; fill: (i: number) => number; label: string }) {
  return (
    <View style={styles.segments} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.segment}>
          <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, fill(i))) * 100)}%` }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flex: 1, flexDirection: "row", columnGap: 6, minHeight: 44, alignItems: "center" },
  segment: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: ON_PICTURE.track },
  fill: { height: 3, backgroundColor: ON_PICTURE.text },
});

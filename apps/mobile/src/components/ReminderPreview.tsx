/**
 * The reminder as it will arrive, drawn as a notification (NT-02, NP-01): what someone agrees to is shown, not
 * described (Vocabulary previews its notification over its time choice,
 * https://mobbin.com/screens/e992e0e3-bea7-4f37-b9bc-5dd096236d7d).
 */

import { Image, StyleSheet, View } from "react-native";

import { useLayout, usePalette } from "../design/tokens";
import type { ReminderText } from "../lib/reminder";
import { Chrome } from "./Type";

export function ReminderPreview({ text, time }: { text: ReminderText; time: string }) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <View style={[styles.frame, { backgroundColor: palette.accent }]} accessible accessibilityLabel={`Preview: ${text.title}. ${text.body}`} testID="reminder-preview">
      <View style={[styles.banner, { backgroundColor: palette.sheet }]}>
        <View style={styles.bannerHead}>
          <Image source={require("../../assets/brand/icon.png")} style={styles.icon} />
          <Chrome step="note" tone="muted" style={{ flex: 1 }}>
            Yada
          </Chrome>
          <Chrome step="note" tone="muted">
            {time}
          </Chrome>
        </View>
        <Chrome tone="ink" style={{ fontWeight: "600" }} numberOfLines={ax ? 4 : 2}>
          {text.title}
        </Chrome>
        <Chrome tone="ink" numberOfLines={2}>
          {text.body}
        </Chrome>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 22, padding: 14 },
  banner: { borderRadius: 16, padding: 12, rowGap: 2 },
  bannerHead: { flexDirection: "row", alignItems: "center", columnGap: 8, marginBottom: 4 },
  icon: { width: 20, height: 20, borderRadius: 5 },
});

/**
 * Build 12: the one empty state (EM-01), centred: what is missing as a title, one line, and the one thing to do as a
 * pill. It replaces each list's own empty sentence (Your list's "Who would you like to pray for?"), so every empty
 * list reads the same way and always offers its way out.
 */

import { StyleSheet, View } from "react-native";

import type { IconName } from "./Icon";
import { Pill } from "./Pill";
import { Chrome } from "./Type";

export function EmptyState({
  title,
  line,
  action,
  icon,
  onAction,
  testID,
}: {
  title: string;
  line: string;
  action: string;
  icon?: IconName;
  onAction: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.empty} testID={testID}>
      <Chrome tone="ink" style={styles.title} accessibilityRole="header">
        {title}
      </Chrome>
      <Chrome tone="muted" style={{ textAlign: "center" }}>
        {line}
      </Chrome>
      <View style={{ marginTop: 10 }}>
        <Pill title={action} icon={icon} primary onPress={onAction} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", rowGap: 10, paddingHorizontal: 16, paddingVertical: 72 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "600", textAlign: "center" },
});

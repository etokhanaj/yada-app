/** One thing said plainly before a choice (PC-02, PC-07, PC-15): an icon without a tile, a bold line, a quiet one. */

import { StyleSheet, View } from "react-native";

import { ON_PICTURE } from "../../design/palette";
import type { IconName } from "../Icon";
import { Icon } from "../Icon";
import { Chrome } from "../Type";

export function Fact({ icon, title, line, onDark = false }: { icon: IconName; title: string; line: string; onDark?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${title}. ${line}`}>
      <View style={styles.icon}>
        <Icon name={icon} size={20} tone={onDark ? "white" : "accent"} />
      </View>
      <View style={{ flex: 1 }}>
        <Chrome tone="ink" style={[{ fontWeight: "600" }, onDark ? { color: ON_PICTURE.text } : null]}>
          {title}
        </Chrome>
        <Chrome step="note" tone="muted" style={[{ marginTop: 2 }, onDark ? { color: ON_PICTURE.muted } : null]}>
          {line}
        </Chrome>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", columnGap: 14, alignItems: "flex-start" },
  icon: { paddingTop: 1 },
});

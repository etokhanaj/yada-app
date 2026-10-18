/**
 * A segmented control (canvas `.seg`): equal segments in a grey capsule, the chosen one raised on the sheet colour
 * with a hairline ring. Used by Saved's Highlights · Notes · Bookmarks · Images (PS-04) and the Note sheet's verse or
 * whole-chapter switch (PS-03). At AX sizes the segments stack (two to a row for four, one for two), as the AX frames
 * draw them, so no label is cut.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { useLayout, usePalette } from "../design/tokens";
import { Chrome } from "./Type";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testID,
}: {
  options: ReadonlyArray<{ readonly value: T; readonly label: string }>;
  value: T;
  onChange: (value: T) => void;
  /** What the choice is, for VoiceOver: "Show", "Note on". */
  label: string;
  testID?: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  const perRow = ax ? (options.length > 2 ? 2 : 1) : options.length;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: palette.fill, borderRadius: ax ? 32 : 999 }]}
      testID={testID}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            // role tab already announces "tab, N of M"; saying it in the label too doubled it (code review, 18 Oct 2026).
            accessibilityLabel={option.label}
            style={[
              styles.segment,
              { width: `${100 / perRow}%` },
              on ? [styles.on, { backgroundColor: palette.sheet, borderColor: palette.edge }] : null,
            ]}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
          >
            {/* Four segments take the canvas's smaller label (PS-04), so "Highlights" and "Bookmarks" fit whole. */}
            <Chrome
              tone={on ? "ink" : "muted"}
              step={options.length > 2 ? "note" : "chrome"}
              numberOfLines={ax ? 2 : 1}
              style={{ fontWeight: on ? "600" : "500", textAlign: "center", fontSize: options.length > 2 && !ax ? 13 : undefined }}
            >
              {option.label}
            </Chrome>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", flexWrap: "wrap", padding: 3 },
  segment: { minHeight: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  on: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});

/**
 * Type settings, from the one quiet "Aa" control: Apple Books' Themes &
 * Settings sheet cut down to text size and appearance
 * (https://mobbin.com/screens/a83c87b2-ce0a-450a-a685-eef410d5628b;
 * Fable https://mobbin.com/screens/2701e6f4-d7f5-40a0-82ef-50e4b7c37163).
 * The brief allows two palettes, so there is no theme gallery. The reader
 * stays visible above the sheet and changes as the controls move.
 */

import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chrome, Label, Prose } from "../components/Type";
import { FONTS, SPACE, usePalette } from "../design/tokens";
import { type Appearance, TEXT_SCALES, useSettings } from "../state/settings";

const APPEARANCES: ReadonlyArray<{ value: Appearance; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function TypeSettings() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const textScale = useSettings((s) => s.textScale);
  const setTextScale = useSettings((s) => s.setTextScale);
  const appearance = useSettings((s) => s.appearance);
  const setAppearance = useSettings((s) => s.setAppearance);
  const step = Math.max(0, TEXT_SCALES.findIndex((s) => s === textScale));
  // At accessibility sizes three labels no longer fit side by side ("Syste/m"
  // at AX3); the choices stack, as iOS's own segmented settings do.
  const stacked = useWindowDimensions().fontScale >= 1.6;

  const sizeButton = (label: string, delta: number, testID: string, accessibilityLabel: string) => {
    const nextStep = step + delta;
    const disabled = nextStep < 0 || nextStep >= TEXT_SCALES.length;
    return (
      <Pressable
        onPress={() => setTextScale(TEXT_SCALES[nextStep] ?? textScale)}
        disabled={disabled}
        style={({ pressed }) => [styles.half, pressed ? { backgroundColor: palette.selection } : null]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
      >
        <Chrome
          tone={disabled ? "muted" : "ink"}
          size={delta < 0 ? 15 : 22}
          style={{ fontFamily: FONTS.scripture, opacity: disabled ? 0.4 : 1 }}
        >
          {label}
        </Chrome>
      </Pressable>
    );
  };

  return (
    <View style={{ backgroundColor: palette.paper, padding: SPACE.lg, paddingBottom: Math.max(insets.bottom, SPACE.lg) }}>
      <Label accessibilityRole="header">Text size</Label>
      <View style={[styles.segment, { borderColor: palette.divider }]}>
        {sizeButton("A", -1, "text-smaller", "Smaller text")}
        <View style={[styles.divider, { backgroundColor: palette.divider }]} />
        {sizeButton("A", 1, "text-larger", "Larger text")}
      </View>
      <Prose step="note" tone="muted" style={{ marginTop: SPACE.xs }}>
        Step {step + 1} of {TEXT_SCALES.length}. Works on top of the system text size.
      </Prose>

      <Label accessibilityRole="header" style={{ marginTop: SPACE.lg }}>
        Appearance
      </Label>
      <View style={[styles.segment, { borderColor: palette.divider }, stacked ? { flexDirection: "column" } : null]}>
        {APPEARANCES.map((option, index) => {
          const selected = option.value === appearance;
          return (
            <View key={option.value} style={stacked ? null : { flex: 1, flexDirection: "row" }}>
              {index > 0 ? (
                <View style={[stacked ? styles.rowDivider : styles.divider, { backgroundColor: palette.divider }]} />
              ) : null}
              <Pressable
                onPress={() => setAppearance(option.value)}
                style={({ pressed }) => [
                  styles.third,
                  stacked ? null : { flex: 1 },
                  selected || pressed ? { backgroundColor: palette.selection } : null,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={`appearance-${option.value}`}
              >
                <Chrome size={16} tone={selected ? "ink" : "muted"} style={selected ? { fontWeight: "600" } : null}>
                  {option.label}
                </Chrome>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    marginTop: SPACE.sm,
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: "hidden",
  },
  half: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  third: {
    minHeight: 44,
    paddingVertical: SPACE.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
});

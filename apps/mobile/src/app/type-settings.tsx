/**
 * Text and appearance (canvas T-01), from the reader's `Aa`: Apple Books'
 * Themes & Settings sheet cut down to text size and appearance
 * (https://mobbin.com/screens/a83c87b2-ce0a-450a-a685-eef410d5628b;
 * Fable https://mobbin.com/screens/2701e6f4-d7f5-40a0-82ef-50e4b7c37163).
 * The reader stays visible above the sheet and changes as the controls move.
 *
 * Appearance is three page thumbnails (amendment 11); at accessibility sizes
 * three tiles no longer fit and it becomes a list. From AX1 the step is fixed
 * at default by the tokens so it never compounds with Dynamic Type, and the
 * stepper says so rather than moving nothing.
 */

import { router } from "expo-router";
import { type AccessibilityActionEvent, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../components/Icon";
import { Chrome, Label } from "../components/Type";
import { useLayout, usePalette } from "../design/tokens";
import { type Appearance, TEXT_SCALES, useSettings } from "../state/settings";

const APPEARANCES: ReadonlyArray<{ value: Appearance; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** A page in each appearance, fixed colours so the choice previews itself (style-v2.css .th-*). */
const THUMB: Readonly<Record<Appearance, { background?: string; image?: string; lines: string }>> = {
  light: { background: "#F7F8F0", lines: "#16231E" },
  dark: { background: "#0E1814", lines: "#ECF0E4" },
  system: { image: "linear-gradient(135deg, #F7F8F0 50%, #0E1814 50%)", lines: "#526D63" },
};

export default function TypeSettings() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { ax, gutter, control } = useLayout();
  const textScale = useSettings((s) => s.textScale);
  const setTextScale = useSettings((s) => s.setTextScale);
  const appearance = useSettings((s) => s.appearance);
  const setAppearance = useSettings((s) => s.setAppearance);
  const step = Math.max(0, TEXT_SCALES.findIndex((s) => s === textScale));
  const value = `${step + 1} of ${TEXT_SCALES.length}`;

  const move = (delta: number) => {
    const next = TEXT_SCALES[step + delta];
    if (!ax && next !== undefined) setTextScale(next);
  };

  const stepButton = (label: string, delta: number, testID: string) => {
    const disabled = ax || TEXT_SCALES[step + delta] === undefined;
    return (
      <Pressable
        onPress={() => move(delta)}
        disabled={disabled}
        testID={testID}
        style={({ pressed }) => [
          styles.step,
          ax ? styles.stepAX : null,
          { backgroundColor: pressed ? palette.selection : palette.fill, opacity: disabled && !ax ? 0.38 : 1 },
        ]}
      >
        <Chrome tone="ink" style={{ fontWeight: "600" }}>
          {label}
        </Chrome>
      </Pressable>
    );
  };

  const title = (
    <Chrome
      step="sheetTitle"
      tone="ink"
      accessibilityRole="header"
      style={ax ? { fontWeight: "600" } : { fontWeight: "600", textAlign: "center", flex: 1, paddingHorizontal: control }}
    >
      Text and appearance
    </Chrome>
  );
  const close = (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Close"
      testID="type-close"
      style={({ pressed }) => [
        styles.close,
        { width: control, height: control, backgroundColor: pressed ? palette.selection : palette.fill },
        ax ? { alignSelf: "flex-end" } : { position: "absolute", right: 0 },
      ]}
    >
      <Icon name="close" size={18} />
    </Pressable>
  );
  // At AX sizes the close control takes its own row and the title sits beneath it (v2-review U4).
  const header = ax ? (
    <View style={styles.headerAX}>
      {close}
      {title}
    </View>
  ) : (
    <View style={styles.header}>
      {title}
      {close}
    </View>
  );

  return (
    <View style={{ backgroundColor: palette.sheet, paddingHorizontal: gutter, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 24) }}>
      {header}

      <Label style={{ marginTop: 24 }}>Text size</Label>
      {ax ? (
        <Chrome tone="ink" style={{ marginTop: 6 }}>
          Using iPhone text size
        </Chrome>
      ) : null}
      {/* One adjustable element to VoiceOver: "Text size, 3 of 6", swipe up or down (brief §5). */}
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Text size"
        accessibilityValue={{ text: ax ? `${value}, using iPhone text size` : value }}
        accessibilityState={{ disabled: ax }}
        accessibilityActions={ax ? [] : [{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e: AccessibilityActionEvent) => move(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        testID="text-size"
        style={[styles.stepper, ax ? { opacity: 0.38, marginTop: 12 } : null]}
      >
        {stepButton("A−", -1, "text-smaller")}
        <Chrome tone="ink" style={{ flex: 1, textAlign: "center", fontVariant: ["tabular-nums"] }} testID="text-size-value">
          {value}
        </Chrome>
        {stepButton("A+", 1, "text-larger")}
      </View>

      <Label style={{ marginTop: 28 }}>Appearance</Label>
      {ax ? (
        <View accessibilityRole="radiogroup" style={{ marginTop: 6 }}>
          {APPEARANCES.map((option, i) => {
            const selected = option.value === appearance;
            return (
              <Pressable
                key={option.value}
                onPress={() => setAppearance(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={option.label}
                testID={`appearance-${option.value}`}
                style={({ pressed }) => [
                  styles.option,
                  i === 0 ? null : { boxShadow: `0 -1px 0 ${palette.divider}` },
                  pressed ? { backgroundColor: palette.fill } : null,
                ]}
              >
                <Chrome tone="ink" style={{ flex: 1, fontWeight: selected ? "600" : "400" }}>
                  {option.label}
                </Chrome>
                {selected ? <Icon name="check" size={20} tone="accent" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={styles.tiles}>
          {APPEARANCES.map((option) => {
            const selected = option.value === appearance;
            const thumb = THUMB[option.value];
            return (
              <Pressable
                key={option.value}
                onPress={() => setAppearance(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={option.label}
                testID={`appearance-${option.value}`}
                style={({ pressed }) => [styles.tile, pressed ? { backgroundColor: palette.fill } : null]}
              >
                <View
                  style={[
                    styles.thumb,
                    {
                      backgroundColor: thumb.background,
                      experimental_backgroundImage: thumb.image,
                      boxShadow: selected ? `0 0 0 2px ${palette.ink}` : `0 0 0 1px ${palette.edge}`,
                    },
                  ]}
                >
                  {[1, 1, 0.6].map((width, i) => (
                    <View key={i} style={[styles.line, { width: `${width * 100}%`, backgroundColor: thumb.lines }]} />
                  ))}
                </View>
                <View style={styles.tileLabel}>
                  {selected ? <Icon name="check" size={14} /> : null}
                  <Chrome tone="ink" size={15} style={{ fontWeight: selected ? "600" : "400" }}>
                    {option.label}
                  </Chrome>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAX: {
    rowGap: 12,
  },
  close: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  step: {
    width: 56,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  stepAX: {
    width: 96,
    height: 72,
  },
  tiles: {
    marginTop: 8,
    flexDirection: "row",
    columnGap: 10,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    rowGap: 8,
    padding: 6,
    borderRadius: 18,
  },
  thumb: {
    width: "100%",
    height: 84,
    borderRadius: 12,
    justifyContent: "center",
    rowGap: 7,
    paddingHorizontal: 14,
  },
  line: {
    height: 3,
    borderRadius: 2,
    opacity: 0.75,
  },
  tileLabel: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
  },
  option: {
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
});

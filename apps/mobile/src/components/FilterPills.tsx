/**
 * Build 12: pills that filter one list (Choose a verse's Today, Saved, For when you're, Recent; Saved's Highlights,
 * Notes, Bookmarks, Images). They scroll sideways and wrap at AX sizes; the chosen one is ink with paper words, so it
 * reads by its fill and its weight, and VoiceOver hears it as selected. `Segmented` stays for two to four equal views
 * of the same thing (design-system.md). A pill may carry a count after its name, lighter, as Search's books do ("John 5",
 * SE-31); its `label` then says what the count counts, so VoiceOver never hears "John 5" as a chapter.
 */

import { Pressable, ScrollView, StyleSheet } from "react-native";

import { useLayout, usePalette } from "../design/tokens";
import { Chrome } from "./Type";

export function FilterPills<K extends string>({
  options,
  chosen,
  onChoose,
  testID,
}: {
  options: ReadonlyArray<{ key: K; title: string; count?: number; label?: string }>;
  chosen: K;
  onChoose: (key: K) => void;
  testID?: string;
}) {
  const palette = usePalette();
  const { ax, gutter } = useLayout();
  return (
    <ScrollView
      horizontal={!ax}
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={ax ? null : { marginHorizontal: -gutter }}
      contentContainerStyle={ax ? styles.wrap : [styles.line, { paddingHorizontal: gutter }]}
      testID={testID}
    >
      {options.map((o) => {
        const on = o.key === chosen;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChoose(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [styles.pill, ax ? styles.pillAx : null, { backgroundColor: on ? palette.ink : palette.fill, opacity: pressed ? 0.8 : 1 }]}
            testID={testID === undefined ? undefined : `${testID}-${o.key}`}
          >
            <Chrome style={{ fontWeight: "600", color: on ? palette.paper : palette.ink }}>
              {o.title}
              {o.count === undefined ? null : <Chrome style={{ fontWeight: "500", opacity: 0.7, color: on ? palette.paper : palette.ink }}>{`  ${o.count}`}</Chrome>}
            </Chrome>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  line: { columnGap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: "center" },
  pillAx: { minHeight: 56, borderRadius: 28 },
});

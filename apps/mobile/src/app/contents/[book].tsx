import { BOOK_CODES, isBookCode } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { TranslationSwitch, usePickChapter } from "../../components/Contents";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { useLayout, usePalette } from "../../design/tokens";

/** A book's chapters (C-02): the one being read in ink; no "16 chapters" — the grid shows it (S17). */
export default function ContentsChapters() {
  const params = useLocalSearchParams<{ book?: string; chapter?: string; from?: string }>();
  const palette = usePalette();
  const { ax } = useLayout();
  const pick = usePickChapter(params.from);
  if (params.book === undefined || !isBookCode(params.book)) return null;
  const book = params.book;
  const meta = BOOK_CODES[book];
  const current = params.chapter === undefined || params.chapter === "" ? null : Number(params.chapter);
  const columns = ax ? 3 : 5;

  return (
    <SheetScreen title={meta.name} backLabel={null} footer={false} testID="contents-chapters">
      <TranslationSwitch />
      <View style={styles.grid}>
        {Array.from({ length: meta.chapters }, (_, i) => i + 1).map((chapter) => {
          const on = chapter === current;
          return (
            <Pressable
              key={chapter}
              onPress={() => pick(book, chapter)}
              accessibilityRole="button"
              accessibilityLabel={`Chapter ${chapter}${on ? ", reading" : ""}`}
              accessibilityState={{ selected: on }}
              testID={`chapter-${book}-${chapter}`}
              style={({ pressed }) => [
                styles.cell,
                { width: `${100 / columns - 2}%`, height: ax ? 96 : 56, backgroundColor: on ? palette.ink : palette.fill },
                pressed && !on ? { opacity: 0.6 } : null,
              ]}
            >
              <Chrome tone={on ? "paper" : "ink"} style={{ fontFamily: "Literata", fontSize: 20, fontWeight: on ? "600" : "400" }} maxFontSizeMultiplier={1.7}>
                {chapter}
              </Chrome>
            </Pressable>
          );
        })}
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: "2.5%",
    rowGap: 8,
  },
  cell: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

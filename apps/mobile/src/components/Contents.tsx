/**
 * Pieces of the Contents sheet: the translation switch and picking a chapter.
 * ChatGPT's and Fable's contents sheets
 * (https://mobbin.com/screens/459b8d99-a0cb-4824-849a-356eea753cf2,
 * https://mobbin.com/screens/a52dd380-49fa-4ad8-9e61-dad04a724cb5).
 */

import type { BookCode } from "@yada/schema";
import { router, useNavigation } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useLayout, usePalette } from "../design/tokens";
import { TRANSLATIONS, useSettings } from "../state/settings";
import { readerHref } from "./navigation";
import { Chrome } from "./Type";

/** BSB · WEB · KJV at the top of Contents (amendment 13: switching translation lives here). */
export function TranslationSwitch() {
  const palette = usePalette();
  const { ax } = useLayout();
  const translation = useSettings((s) => s.translation);
  const setTranslation = useSettings((s) => s.setTranslation);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Translation"
      style={[styles.seg, ax ? styles.segAx : null, { backgroundColor: palette.fill }]}
    >
      {TRANSLATIONS.map((t) => {
        const on = t.code === translation;
        return (
          <Pressable
            key={t.code}
            onPress={() => setTranslation(t.code)}
            accessibilityRole="radio"
            accessibilityLabel={t.name}
            accessibilityState={{ selected: on }}
            testID={`translation-${t.code}`}
            style={[
              styles.option,
              ax ? null : { flex: 1 },
              on ? { backgroundColor: palette.sheet, boxShadow: `0 1px 4px rgba(0,0,0,0.08), 0 0 0 0.5px ${palette.edge}` } : null,
            ]}
          >
            <Chrome tone={on ? "ink" : "muted"} style={{ fontWeight: on ? "600" : "500" }}>
              {t.code}
            </Chrome>
          </Pressable>
        );
      })}
    </View>
  );
}

interface StackLike {
  getParent(): StackLike | undefined;
  getState(): { key: string } | undefined;
  dispatch(action: { type: string; payload?: unknown; target?: string }): void;
}

/** Close Contents and read the chapter: in the reader it replaces the chapter, from Home it opens one. */
export function usePickChapter(from: string | undefined) {
  const navigation = useNavigation() as unknown as StackLike;
  return (book: BookCode, chapter: number) => {
    const host = navigation.getParent();
    const key = host?.getState()?.key;
    if (host !== undefined && key !== undefined) host.dispatch({ type: "POP", payload: { count: 1 }, target: key });
    if (from === "home") router.push(readerHref({ book, chapter }));
    // Jumps land instantly (brief §5); the reader resets its scroll on a new chapter.
    else router.navigate(readerHref({ book, chapter }));
  };
}

const styles = StyleSheet.create({
  seg: {
    flexDirection: "row",
    padding: 3,
    columnGap: 2,
    borderRadius: 999,
    marginBottom: 28,
  },
  segAx: {
    flexDirection: "column",
    borderRadius: 32,
  },
  option: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});

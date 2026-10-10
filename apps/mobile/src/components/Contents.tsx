/**
 * Pieces of the Contents sheet: the Translation row and picking a chapter.
 * ChatGPT's and Fable's contents sheets
 * (https://mobbin.com/screens/459b8d99-a0cb-4824-849a-356eea753cf2,
 * https://mobbin.com/screens/a52dd380-49fa-4ad8-9e61-dad04a724cb5).
 */

import type { BookCode } from "@yada/schema";
import { router, useNavigation } from "expo-router";
import { View } from "react-native";

import { useTranslationName } from "../data/translations";
import { useSettings } from "../state/settings";
import { readerHref } from "./navigation";
import { ListRow } from "./Page";
import { Chrome } from "./Type";

/**
 * `Translation        BSB ›` at the top of Contents (MT-01; amendment 13:
 * switching translation lives here). One value row, Apple Settings' pattern:
 * four segments was the most that fitted, and downloads would break them.
 */
export function TranslationValueRow() {
  const translation = useSettings((s) => s.translation);
  const name = useTranslationName(translation);
  return (
    <View style={{ marginBottom: 28 }}>
      <ListRow
        first
        title={<Chrome tone="ink" style={{ fontWeight: "500" }}>Translation</Chrome>}
        right={
          <Chrome tone="muted" testID="contents-translation-value">
            {translation}
          </Chrome>
        }
        label={`Translation, ${name}`}
        onPress={() => router.push("/translations")}
        testID="contents-translation"
      />
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

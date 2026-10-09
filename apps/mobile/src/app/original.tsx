/**
 * Original, straight from the selection pill: the Greek or Hebrew under each
 * selected verse, every word tappable. The same component Understand uses
 * inline, without the explanation around it.
 */

import { formatDisplayRef, ordToParts } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { glossCaption, OriginalWords } from "../components/OriginalWords";
import { SheetScreen } from "../components/Sheet";
import { Label, Prose, Scripture } from "../components/Type";
import { useCore, useQuery } from "../data/AppData";
import { getTextsInRange, getTokens, scriptOf } from "../data/queries";
import { SPACE } from "../design/tokens";
import { formatRange, resolveRef } from "../lib/chapters";
import { missingOriginalNote } from "../lib/omissions";
import { useSettings } from "../state/settings";

export default function OriginalScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const span = resolveRef(params.ref ?? "");
  const core = useCore();
  const translation = useSettings((s) => s.translation);

  const { data } = useQuery(async () => {
    if (span === null) return null;
    const verses = await getTextsInRange(core, span.startOrd, span.endOrd);
    return Promise.all(verses.map(async (v) => ({ ...v, tokens: await getTokens(core, v.ord) })));
  }, [params.ref]);

  const label = span === null ? null : formatRange(params.ref ?? "");
  if (data === undefined || data === null || span === null) return <SheetScreen backLabel={label}>{null}</SheetScreen>;
  const script = scriptOf(span.book);
  const first = ordToParts(span.startOrd);
  const firstId = `${first.book}.${first.chapter}.${first.verse}`;

  return (
    <SheetScreen backLabel={label} verseId={firstId}>
      <Label accessibilityRole="header">
        {script === "hebrew" ? "Original Hebrew" : "Original Greek"} · {label}
      </Label>
      {data.map(({ ord, texts, tokens }, index) => {
        const parts = ordToParts(ord);
        const id = `${parts.book}.${parts.chapter}.${parts.verse}`;
        const full = missingOriginalNote(id, script, tokens.words.length > 0);
        // John 7:53–8:11 is twelve verses; the full sentence once, then a short one.
        const previous = data[index - 1];
        const previousNote =
          previous === undefined
            ? null
            : missingOriginalNote(
                (({ book, chapter, verse }) => `${book}.${chapter}.${verse}`)(ordToParts(previous.ord)),
                script,
                previous.tokens.words.length > 0,
              );
        const omission =
          full !== null && full === previousNote ? `No ${script === "hebrew" ? "Hebrew" : "Greek"} for this verse either.` : full;
        return (
          <View key={ord} style={{ marginTop: SPACE.lg }}>
            {data.length > 1 ? <Label tone="ink">{formatDisplayRef(parts)}</Label> : null}
            <Scripture step="explanation" tone="muted" style={{ marginTop: SPACE.xs, marginBottom: SPACE.md }}>
              {texts[translation] ?? texts.BSB ?? ""}
            </Scripture>
            {omission !== null ? (
              <Prose step="claim" tone="muted" testID="omission-note">
                {omission}
              </Prose>
            ) : (
              <OriginalWords tokens={tokens} script={script} from={id} />
            )}
          </View>
        );
      })}
      {data[0] !== undefined && data[0].tokens.words.length > 0 ? (
        <Prose step="note" tone="muted" style={{ marginTop: SPACE.lg }}>
          {glossCaption(data[0].tokens)}
        </Prose>
      ) : null}
    </SheetScreen>
  );
}

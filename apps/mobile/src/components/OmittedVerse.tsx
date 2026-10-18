/**
 * A verse modern translations leave out, said plainly (canvas PD-06): one sentence, then the words the KJV
 * has for it as a quoted verse, then "KJV, 1769". No sigla, no brackets. Shown in Understand on the verse
 * and from Compare's "Why: not in the oldest manuscripts" (CP-08). Nothing is shown unless the verse is a
 * listed omission and the KJV on the phone has words for it (rule 4).
 */

import { BOOK_CODES, type BookCode, formatVerseId, ordToParts } from "@yada/schema";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { useCore, useQuery } from "../data/AppData";
import { getTexts } from "../data/queries";
import { usePalette } from "../design/tokens";
import { FONTS } from "../design/type";
import { KJV_EDITION, omittedVerseLine } from "../lib/omissions";
import { spokenText } from "../lib/supplied";
import { Icon } from "./Icon";
import { Chrome, Prose, Scripture } from "./Type";
import { DivineText } from "./Verse";

/**
 * Whether a verse gets PD-06's note: a listed omission with the KJV's words for it. Null when there is no verse
 * (an unresolved ref): callers passed 0 instead, and ordToParts(0) throws.
 */
export function useOmittedVerse(ord: number | null): { line: string; kjv: string } | null {
  const core = useCore();
  const parts = ord === null ? null : ordToParts(ord);
  const line = parts === null ? null : omittedVerseLine(formatVerseId(parts), BOOK_CODES[parts.book].name);
  const { data } = useQuery(async () => (ord === null || line === null ? null : ((await getTexts(core, ord))["KJV"] ?? "")), [ord, line]);
  if (line === null || data === undefined || data === null || data.trim() === "") return null;
  return { line, kjv: data };
}

export function OmittedVerseNote({ note }: { note: { line: string; kjv: string } }) {
  return (
    <>
      <Prose step="explanation" testID="omitted-verse-line">
        {note.line}
      </Prose>
      <QuotedVerse text={note.kjv} translation="KJV" />
      <Chrome step="note" tone="muted">
        {KJV_EDITION}
      </Chrome>
    </>
  );
}

/**
 * PD-05: in the reader, a verse the version leaves out keeps its place as one quiet line, "4 Not in the oldest
 * manuscripts ›", which opens PD-06's note. Drawn before the verse that follows the gap, for each listed
 * omission in the gap; a gap that is a numbering difference shows nothing (lib/omissions.ts).
 */
export function MissingVerseLines({ book, chapter, after, before }: { book: BookCode; chapter: number; after: number; before: number }) {
  const gap: number[] = [];
  for (let v = after + 1; v < before; v++) {
    if (omittedVerseLine(formatVerseId({ book, chapter, verse: v }), BOOK_CODES[book].name) !== null) gap.push(v);
  }
  return (
    <>
      {gap.map((v) => (
        <MissingVerseLine key={v} book={book} chapter={chapter} verse={v} />
      ))}
    </>
  );
}

function MissingVerseLine({ book, chapter, verse }: { book: BookCode; chapter: number; verse: number }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/understand", params: { ref: formatVerseId({ book, chapter, verse }) } })}
      accessibilityRole="button"
      accessibilityLabel={`Verse ${verse} is not in the oldest manuscripts. Opens a note`}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", columnGap: 6, minHeight: 44, marginTop: -4, marginBottom: 10 }, pressed ? { opacity: 0.6 } : null]}
      testID={`missing-verse-${verse}`}
    >
      <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
        {verse}
      </Chrome>
      <Chrome step="note" tone="muted" style={{ fontStyle: "italic" }}>
        Not in the oldest manuscripts
      </Chrome>
      <Icon name="forward" size={14} tone="muted" />
    </Pressable>
  );
}

/**
 * A verse quoted inside a note (canvas `.kq`): Literata at claim size, set off by a hairline at its left.
 * PD-06's KJV verse and Compare's agreeing text (CP-03).
 */
export function QuotedVerse({ text, translation, children }: { text: string; translation: string; children?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={{ marginTop: 10, marginBottom: 4, paddingLeft: 12, borderLeftWidth: 1.5, borderLeftColor: palette.divider }}>
      <Scripture step="claim" accessibilityLabel={spokenText(text, translation)} style={{ fontFamily: FONTS.scripture }} testID="quoted-verse">
        {children ?? <DivineText text={text} translation={translation} />}
      </Scripture>
    </View>
  );
}

/**
 * The book's introduction at the top of chapter 1 (build 6 item G; canvas IG-01, IG-02). One paragraph from
 * tN, cut by rule and approved by John, above the first passage title: a quiet "About John" label, the
 * paragraph in the reading size in muted ink so it never reads as Scripture, and its credit. Blinkist's
 * "Introduction" above the opening paragraph, https://mobbin.com/screens/ea3c48f7-2bb6-4fd2-aec0-01dc925042cf;
 * the chapter then starts as Apple Books starts one, https://mobbin.com/screens/8a868d50-e016-47a5-88d4-e61514ead594.
 *
 * Nothing while the file is coming or for a book with none (Genesis): no placeholder in reading (CLAUDE.md).
 */

import { BOOK_CODES, type BookCode } from "@yada/schema";
import { View } from "react-native";

import { useQuery } from "../data/AppData";
import { loadBookIntro, useUnderstand } from "../data/understand";
import { Label, Prose } from "./Type";

export function BookIntro({ book, chapter }: { book: BookCode; chapter: number }) {
  const file = useUnderstand((s) => s.installed[book]?.file ?? null);
  const { data } = useQuery(async () => (chapter === 1 && file !== null ? loadBookIntro(book) : null), [book, chapter, file]);
  if (data === undefined || data === null) return null;
  const name = BOOK_CODES[book].name;
  return (
    <View style={{ marginTop: 2, marginBottom: 26 }} testID="book-intro">
      <Label style={{ marginBottom: 6 }}>{`About ${name}`}</Label>
      <Prose step="claim" tone="muted">
        {data.text}
      </Prose>
      <Prose step="note" tone="muted" style={{ marginTop: 8 }}>
        {data.credit}
      </Prose>
    </View>
  );
}

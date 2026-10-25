/**
 * A note (NT-30): a sheet at the medium detent, so the verse it is on stays in view above it on the reader; "Note ·
 * John 2:4" with Done, the note itself in Literata at the reading size, one line saying who sees it. Saved as the
 * reader writes, so closing the sheet never loses a word; emptying a note deletes it.
 *
 * Reached from the verse sheet's Note, the note mark after a verse number and Saved › Notes (a whole chapter's note
 * opens with `whole=1`).
 */

import { type BookCode, formatVerseId, isBookCode } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useSheetNav } from "../components/navigation";
import { Pill } from "../components/Pill";
import { SheetScreen } from "../components/Sheet";
import { Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { loadNote, saveNote } from "../data/user";
import { FONTS, useLayout, usePalette, useType } from "../design/tokens";
import { NOTE_MAX } from "../lib/highlights";
import { chapterTitle } from "../lib/reader";
import { verseLabel } from "../lib/saved";

/** Saving waits for a pause in typing, so a note is one write per thought, not one per letter. */
const SAVE_DELAY_MS = 600;

/** A whole number at least `min`: verse 0 is a psalm's title, which takes a note too (lib/saved.ts verseLabel). */
const wholeNumber = (value: string | undefined, min: number): number | null => {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isInteger(n) && n >= min ? n : null;
};

export default function NoteSheet() {
  const params = useLocalSearchParams<{ book: string; chapter: string; verse?: string; whole?: string }>();
  const chapter = wholeNumber(params.chapter, 1);
  const verse = params.verse === undefined ? null : wholeNumber(params.verse, 0);
  // A link that names no real place opens nothing rather than a note on "undefined.NaN" (code review, 18 Oct 2026).
  if (!isBookCode(params.book) || chapter === null || (params.verse !== undefined && verse === null)) return null;
  return <NoteEditor book={params.book} chapter={chapter} verse={params.whole === "1" ? null : verse} />;
}

function NoteEditor({ book, chapter, verse }: { book: BookCode; chapter: number; verse: number | null }) {
  const palette = usePalette();
  const { gutter } = useLayout();
  const reading = useType("scripture");
  const { closeSheet } = useSheetNav();
  const { user } = useAppData();
  const target = verse !== null ? formatVerseId(book, chapter, verse) : `${book}.${chapter}`;
  const place = verse !== null ? verseLabel({ book, chapter, verse }) : chapterTitle(book, chapter);
  const [body, setBody] = useState<string | null>(null);
  const field = useRef<TextInput>(null);

  const pending = useRef<{ target: string; body: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (next === null) return;
    // A failed write keeps the words waiting, so the next blur tries again rather than dropping them (code review,
    // 18 Oct 2026); anything typed since is newer and wins.
    saveNote(user, next.target, next.body).catch(() => {
      if (pending.current === null) pending.current = next;
    });
  };
  // Leaving the sheet, by Done or a drag down, saves what is waiting first.
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    void loadNote(user, target).then((text) => {
      if (!live) return;
      setBody(text);
      // The caret is in the note once its words are in (NT-30): the sheet is opened to write.
      requestAnimationFrame(() => field.current?.focus());
    });
    return () => {
      live = false;
    };
  }, [user, target]);

  const edit = (text: string) => {
    setBody(text);
    pending.current = { target, body: text };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  const header = (
    <View style={[styles.head, { paddingHorizontal: gutter }]}>
      <Chrome step="sheetTitle" tone="ink" accessibilityRole="header" style={styles.title}>
        {`Note · ${place}`}
      </Chrome>
      <Pill
        primary
        small
        title="Done"
        label="Done, close the note"
        onPress={() => {
          flush();
          closeSheet();
        }}
        testID="note-done"
      />
    </View>
  );

  return (
    <SheetScreen title="Note" header={header} backLabel={null} footer={false} noBack keyboard testID="note">
      {/* NT-30: the note in Literata at the reader's own size, on the sheet itself, not a field box. */}
      <TextInput
        value={body ?? ""}
        editable={body !== null}
        onChangeText={edit}
        onBlur={flush}
        ref={field}
        multiline
        maxLength={NOTE_MAX}
        placeholder="Write a note"
        placeholderTextColor={palette.mutedInk}
        accessibilityLabel={`Your note on ${place}`}
        style={[styles.field, { color: palette.ink, fontSize: reading.size, lineHeight: Math.round(reading.size * 1.5) }]}
        testID="note-field"
      />
      <Chrome step="note" tone="muted" style={styles.kept}>
        Only you see your notes
      </Chrome>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12, minHeight: 56, paddingTop: 10 },
  title: { flexShrink: 1 },
  field: { marginTop: 4, minHeight: 120, padding: 0, fontFamily: FONTS.scripture, textAlignVertical: "top" },
  kept: { marginTop: 8 },
});

/**
 * A note (PS-03): a sheet over the reader titled "Note" with the reference, the verse quoted in muted Literata, a
 * switch between the verse and the whole chapter, and the editor on the card fill. One line says who sees it. Saved as
 * the reader writes, so closing the sheet never loses a word; emptying a note deletes it.
 *
 * Reached from the bar's Note (PS-01), the note mark after a verse number (PS-02) and Saved › Notes (PS-04).
 */

import { type BookCode, formatVerseId, isBookCode, verseOrd } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Segmented } from "../components/Segmented";
import { SheetScreen } from "../components/Sheet";
import { Chrome, Scripture } from "../components/Type";
import { useAppData, useCore, useQuery } from "../data/AppData";
import { cloudAvailable } from "../data/cloud";
import { isLicensedCode } from "../data/licensed";
import { getTextsForOrds } from "../data/queries";
import { loadNote, saveNote } from "../data/user";
import { FONTS, usePalette } from "../design/tokens";
import { NOTE_MAX } from "../lib/highlights";
import { chapterTitle, excerptOf } from "../lib/reader";
import { verseLabel } from "../lib/saved";
import { useSettings } from "../state/settings";

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
  // A note opened as a whole chapter's (Saved › Notes) has no verse to quote or switch to.
  const verse = params.verse === undefined ? null : wholeNumber(params.verse, 0);
  // A link that names no real place opens nothing rather than a note on "undefined.NaN" (code review, 18 Oct 2026).
  if (!isBookCode(params.book) || chapter === null || (params.verse !== undefined && verse === null)) return null;
  return <NoteEditor book={params.book} chapter={chapter} verse={verse} startWhole={params.whole === "1" || verse === null} />;
}

function NoteEditor({ book, chapter, verse, startWhole }: { book: BookCode; chapter: number; verse: number | null; startWhole: boolean }) {
  const palette = usePalette();
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const [scope, setScope] = useState<"verse" | "chapter">(startWhole ? "chapter" : "verse");
  const target = scope === "verse" && verse !== null ? formatVerseId(book, chapter, verse) : `${book}.${chapter}`;
  const [body, setBody] = useState<string | null>(null);

  // A licensed version is not on the phone: the verse quoted is the BSB's (US-11).
  const shown = isLicensedCode(translation) ? "BSB" : translation;
  const ord = verse === null ? null : verseOrd(book, chapter, verse);
  const { data: texts } = useQuery(async () => (ord === null ? new Map<number, string>() : getTextsForOrds(core, [ord], shown)), [ord, shown]);
  const quote = ord === null ? "" : excerptOf(texts?.get(ord) ?? "");

  const pending = useRef<{ target: string; body: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (next === null) return;
    // A failed write keeps the words waiting, so the next blur or switch tries again rather than dropping them
    // (code review, 18 Oct 2026); anything typed since is newer and wins.
    saveNote(user, next.target, next.body).catch(() => {
      if (pending.current === null) pending.current = next;
    });
  };
  // Leaving the sheet, or switching between the verse and the chapter, saves what is waiting first.
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    setBody(null);
    void loadNote(user, target).then((text) => {
      if (live) setBody(text);
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

  const verseName = verse === null ? null : verseLabel({ book, chapter, verse });
  const chapterName = `All of ${chapterTitle(book, chapter)}`;
  const place = scope === "verse" && verseName !== null ? verseName : chapterTitle(book, chapter);
  return (
    <SheetScreen title="Note" subtitle={place} backLabel={null} footer={false} noBack keyboard testID="note">
      {quote === "" ? null : (
        <Scripture step="claim" tone="muted" style={styles.quote}>
          {quote}
        </Scripture>
      )}
      {verseName === null ? null : (
        <Segmented
          label="Note on"
          options={[
            { value: "verse", label: verseName },
            { value: "chapter", label: chapterName },
          ]}
          value={scope}
          onChange={(next) => {
            flush();
            setScope(next);
          }}
          testID="note-scope"
        />
      )}
      <TextInput
        value={body ?? ""}
        editable={body !== null}
        onChangeText={edit}
        onBlur={flush}
        multiline
        maxLength={NOTE_MAX}
        placeholder="Write a note"
        placeholderTextColor={palette.mutedInk}
        accessibilityLabel={`Your note on ${place}`}
        style={[styles.field, { backgroundColor: palette.card, color: palette.ink }]}
        testID="note-field"
      />
      <View style={styles.kept}>
        <Chrome step="note" tone="muted">
          {cloudAvailable() ? "Kept on this iPhone and in your iCloud. Only you see it." : "Kept on this iPhone. Only you see it."}
        </Chrome>
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  // The verse quoted in muted Literata (PS-03); the claim step alone is the system face.
  quote: { marginBottom: 16, fontFamily: FONTS.scripture },
  // PS-03: the editor on the card fill, Literata, as anything the reader writes about Scripture (design system).
  field: { marginTop: 20, minHeight: 140, borderRadius: 24, padding: 16, fontFamily: FONTS.scripture, fontSize: 17, lineHeight: 25, textAlignVertical: "top" },
  kept: { marginTop: 10 },
});

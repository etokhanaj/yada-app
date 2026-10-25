import type { BookCode } from "@yada/schema";
import { useEffect } from "react";

import { useQuery } from "../../data/AppData";
import { readingKey, readText, refreshRecordings, useRecordings } from "../../data/recordings";
import { loadPericopes } from "../../data/understand";
import type { PericopeRow } from "../../lib/pericopes";
import type { AudioSession } from "../../state/audio";

/** The book's passages (empty where the book has no bundle yet). */
export function usePericopes(book: BookCode | undefined): readonly PericopeRow[] {
  const { data } = useQuery(async () => (book === undefined ? [] : loadPericopes(book)), [book]);
  return data ?? [];
}

/** The voice reading the session, "Heart": the docked player's "Heart · 1×" (RD-32) and the mini player's line (LS-30). */
export function useVoiceName(session: AudioSession | null): string | null {
  const key = session === null ? "" : readingKey(session.book, readText(session.translation) ?? "BSB");
  const name = useRecordings((s) => s.books[key]?.narrator_name ?? null);
  // A chapter already on the phone plays without reading the manifest, so the voices' names were never loaded and the
  // pill said only "1×" (12g QA). One read a launch: refreshRecordings runs once however often it is asked.
  const missing = session !== null && name === null;
  useEffect(() => {
    if (missing) void refreshRecordings();
  }, [missing]);
  return name;
}

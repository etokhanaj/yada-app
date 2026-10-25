/**
 * Sit's reading in Heart or George (Build 12: "our default sound is the apple voice, can we change that?"). The
 * verse is played from its chapter's recording with that recording's word timings, as the reader plays it. The
 * first play streams the chapter, as Listen does (ST-01). Offline with the chapter not on the phone there is no
 * reading, and no other voice stands in: Sit says so and the verse is read in silence.
 */

import { parseVerseId } from "@yada/schema";

import type { RecordedSegment } from "../../modules/yada-speech";
import { wordRanges } from "../lib/audio/text";
import { verseRun } from "../lib/sitVoice";
import { wordSpans } from "../lib/sit";
import { audioTranslation } from "./audio";
import { type Db, getChapter } from "./queries";
import { isRecorded, READ_TEXTS, type ReadText, recordingOnPhone, refreshRecordings, streamChapter, useRecordings } from "./recordings";
import { useSettings } from "../state/settings";

export type SitReading = { readonly segments: readonly RecordedSegment[] } | { readonly missing: "offline" | "failed" };

/** Null when Sit's words aren't a run of one chapter's verses in a recorded text (then it reads in silence too). */
export async function sitReading(core: Db, place: string, text: string): Promise<SitReading | null> {
  const at = parseVerseId(place);
  if (at === null) return null;
  const sit = wordSpans(text);
  const sitWords = sit.map((w) => text.slice(w.start, w.end));
  // The text Sit shows: the reader's own where it is recorded, else whichever recorded text these words are.
  const own = audioTranslation(useSettings.getState().translation);
  const texts = [...new Set([own, ...READ_TEXTS].filter((t): t is ReadText => READ_TEXTS.some((r) => r === t)))];
  for (const t of texts) {
    const verses = await getChapter(core, at.book, at.chapter, t);
    const withWords = verses.map((v) => ({ verse: v.verse, words: wordRanges(v.text).map((w) => v.text.slice(w.start, w.end)) }));
    const run = verseRun(sitWords, withWords, at.verse);
    if (run === null) continue;
    let rec = await recordingOnPhone(at.book, at.chapter, t);
    if (rec === null) await refreshRecordings();
    if (rec === null && isRecorded(at.book, at.chapter, t) && useRecordings.getState().online === true) rec = await streamChapter(at.book, at.chapter, t);
    if (rec === null) return { missing: useRecordings.getState().online === true ? "failed" : "offline" };
    const timings = rec.timings;
    const segments = run.flatMap((part): RecordedSegment[] => {
      const timing = timings.verses.find((v) => v.verse === part.verse);
      const verseWords = withWords.find((v) => v.verse === part.verse)?.words.length ?? -1;
      if (timing === undefined) return [];
      // Timings from another edition of the text would light the wrong words: the verse still plays, unlit.
      const lit = timing.words.length === verseWords;
      return [
        {
          path: rec.path,
          ...(rec.stream === undefined ? {} : { savePath: rec.stream.savePath, bytes: rec.stream.bytes }),
          start: lit ? (timing.words[part.first] ?? timing.start) : timing.start,
          end: timing.end,
          times: lit ? timing.words.slice(part.first, part.first + part.count) : [],
          locations: lit ? sit.slice(part.sitFirst, part.sitFirst + part.count).map((w) => w.start) : [],
        },
      ];
    });
    return segments.length === 0 ? null : { segments };
  }
  return null;
}

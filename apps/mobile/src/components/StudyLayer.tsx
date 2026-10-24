/**
 * Tyndale's study notes, People and See also in Understand (artifact "How Yada uses the open
 * study notes", approved by John 11 Oct 2026; canvas SN-01–08 and TD-01–03 after the UX pass,
 * notes refs_sn and refs_td).
 *
 * - A verse with a Yada entry keeps Understand as it was. People, "Study notes" (Tyndale) and
 *   "See also" (N passages) are rows in Go further, each pushing a page inside the sheet.
 * - A verse without one leads with People, then Study notes inline (the first paragraph at four
 *   lines, "Read the whole note" pushing the Study notes page), then See also inline (three rows,
 *   "Show all N"), then Go further.
 * - The Study notes page: every paragraph, then each note on a passage around the verse under
 *   its "On 1:1–18" line, then the credit. Quoted words (`<x>`) in italics; a note that opens on
 *   them reads “words” (NLT): so they are not taken for the BSB on screen.
 * - See also is one list: Yada's related passages first (second line: why), then OpenBible's
 *   (second line: the first verse in BSB, with no " …" for a range: the reference already shows
 *   the range; last visual pass, 11 Oct 2026). A row opens the passage in the reader with
 *   its return chip (SN-07). Votes rank and are never shown; OpenBible's credit shows only while
 *   one of its rows does.
 * - Downloads ask nothing: a book's notes come down the first time it opens while online
 *   (data/study.ts ensureStudy). Until then, one line: getting them (after a second), failed with
 *   "Try again", or offline.
 *
 * References: Public's term sheet with a source line
 * (https://mobbin.com/screens/93eeef7a-1110-439f-8d05-5d3bbe02747d), Matter's notebook prose with a
 * quiet source (https://mobbin.com/screens/a855cd68-c4dd-4433-a830-90f54e903ae2), Perplexity's
 * References rows (https://mobbin.com/screens/a355e53b-c3cc-4215-a81f-6cd31ff7ba27).
 *
 * The notes never carry the Unreviewed label: it belongs to Yada's own entry alone. Nothing here
 * rewrites a note or sends one anywhere (CLAUDE.md rule 9).
 */

import { type BookCode, formatDisplayRef, formatVerseId, ordToParts, parseVerseId } from "@yada/schema";
import { router } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SourceLine } from "./SourceLine";

import { useAppData, useCore, useQuery } from "../data/AppData";
import { getTexts, getTextsInRange, isDownloaded, isTranslation } from "../data/queries";
import { ensureStudy, loadProfile, loadRangeNotes, loadVerseStudy, useStudy, type VerseStudy } from "../data/study";
import { loadVersePlaces } from "../data/wordsAndPlaces";
import { FONTS, useLayout, usePalette, useType } from "../design/tokens";
import {
  failedLine,
  FETCHING_DELAY_MS,
  fetchingLine,
  isOwnNote,
  leadingLemma,
  type Named,
  namedInVerse,
  needsMore,
  type NoteParagraph,
  noteReferences,
  type NoteSegment,
  OFFLINE_LINE,
  onRangeLine,
  OPENBIBLE_LINE,
  parseFurtherStudy,
  parseNoteMarkup,
  profileBody,
  rangeTitle,
  readAboutLabel,
  SEE_ALSO_FIRST,
  type SeeAlsoItem,
  spokenRange,
  stripLeadReference,
  stripOwnReference,
  type StudyNoteRow,
  TYNDALE_LINE,
  TYNDALE_SHORT,
  TYNDALE_SHORTENED,
  whoLine,
} from "../lib/study";
import { useSettings } from "../state/settings";
import { useSheetBase, useSheetNav } from "./navigation";
import { Row, RowNote, Section, SheetScreen, TextCapsule, TextLink, UNDERSTAND_EXIT } from "./Sheet";
import { Chrome, Prose, Scripture } from "./Type";
import { DivineText } from "./Verse";

export type StudyState =
  | { readonly kind: "loading" }
  | { readonly kind: "none" }
  | { readonly kind: "fetching" }
  | { readonly kind: "failed" }
  | { readonly kind: "offline" }
  | { readonly kind: "ready"; readonly study: VerseStudy };

/** What the study layer has for a verse; fetching the book's notes if they are not on the phone. */
export function useVerseStudy(book: BookCode, ord: number, bsbText: string | undefined): StudyState {
  const { user } = useAppData();
  const installed = useStudy((s) => s.installed[book]);
  const offered = useStudy((s) => s.catalogue[book] !== undefined);
  const known = useStudy((s) => Object.keys(s.catalogue).length > 0);
  const online = useStudy((s) => s.online);
  const downloading = useStudy((s) => s.downloading[book] !== undefined);
  const failed = useStudy((s) => s.failed[book] === true);
  useEffect(() => {
    if (installed === undefined) void ensureStudy(user, book);
  }, [installed, user, book]);
  const { data } = useQuery(
    async () => (bsbText === undefined ? undefined : loadVerseStudy(book, ord, bsbText)),
    [book, ord, installed?.file ?? "", bsbText ?? "·"],
  );
  if (installed !== undefined) {
    if (data === undefined) return { kind: "loading" };
    if (data === null || (data.notes.length === 0 && data.xrefs.length === 0 && data.people.length === 0)) return { kind: "none" };
    return { kind: "ready", study: data };
  }
  if (downloading) return { kind: "fetching" };
  // Only a book the manifest lists has notes to wait for (decision for build 3, 11 Oct): any
  // other shows nothing extra, and so does every book until a manifest, fresh or last good, has
  // said which are listed.
  if (!offered) return online === null && !known ? { kind: "loading" } : { kind: "none" };
  if (failed) return online === false ? { kind: "offline" } : { kind: "failed" };
  if (online === false) return { kind: "offline" };
  return { kind: "fetching" };
}

/** True when the state takes a line in the sheet, so the sections around it can space themselves. */
export function hasStatusLine(state: StudyState): boolean {
  return state.kind === "fetching" || state.kind === "failed" || state.kind === "offline";
}

/** The one line shown while a book's notes are not on the phone (canvas SN brief 4). */
export function StudyStatus({ book, state, first = false }: { book: BookCode; state: StudyState; first?: boolean }) {
  const { user } = useAppData();
  const { sectionGap, ax } = useLayout();
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (state.kind !== "fetching") return;
    const timer = setTimeout(() => {
      setLate(true);
      AccessibilityInfo.announceForAccessibility(fetchingLine(book));
    }, FETCHING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.kind, book]);
  const style = { marginTop: first ? 0 : sectionGap };
  if (state.kind === "fetching") {
    return late ? (
      <Chrome step="note" tone="muted" role="status" style={style} testID="study-fetching">
        {fetchingLine(book)}
      </Chrome>
    ) : null;
  }
  if (state.kind === "failed") {
    return (
      // Canvas SN-05 (`.row.dlfail`, `.tbtn2`): the line, then Try again as a filled capsule at
      // its trailing edge; at AX sizes the capsule drops under the line.
      <View style={[style, ax ? styles.failedAx : styles.failed]} testID="study-failed">
        <Chrome step="note" tone="muted" role="status" style={ax ? null : { flex: 1 }}>
          {failedLine(book)}
        </Chrome>
        <TextCapsule label="Try again" a11yLabel="Try the study notes download again" onPress={() => void ensureStudy(user, book, true)} testID="study-retry" />
      </View>
    );
  }
  if (state.kind === "offline") {
    return (
      <Chrome step="note" tone="muted" style={style} testID="study-offline">
        {OFFLINE_LINE}
      </Chrome>
    );
  }
  return null;
}

function Segments({ segments }: { segments: readonly NoteSegment[] }) {
  return (
    <>
      {segments.map((s, j) => (
        <Text
          key={j}
          style={[
            s.quoted || s.italic ? { fontFamily: FONTS.scriptureItalic } : null,
            s.bold ? { fontWeight: "600" } : null,
            // As the reader sets LORD (Verse.tsx): the font's own small capitals.
            s.smallCaps ? { fontVariant: ["small-caps"], letterSpacing: 0.6 } : null,
          ]}
        >
          {s.text}
        </Text>
      ))}
    </>
  );
}

/** One paragraph of a note, set in Literata at the claim size (canvas `.snote`). */
function NoteParagraphText({ paragraph, lines, lead }: { paragraph: NoteParagraph; lines?: number; lead: boolean }) {
  const palette = usePalette();
  const note = useType("note");
  const lemma = lead ? leadingLemma(paragraph) : null;
  return (
    <Prose
      step="claim"
      numberOfLines={lines}
      style={[{ fontFamily: FONTS.scripture }, paragraph.heading ? { fontWeight: "600" } : null]}
      accessibilityRole={paragraph.heading ? "header" : undefined}
    >
      {lemma !== null ? (
        <>
          {"“"}
          <Text style={{ fontFamily: FONTS.scriptureItalic }}>{lemma.lemma}</Text>
          {"” "}
          {/* Upright and muted at the note size (canvas `.nlt`): whose words they are. */}
          <Text style={{ fontFamily: "System", fontSize: note.size, color: palette.mutedInk }}>(NLT)</Text>
          {": "}
          <Segments segments={lemma.rest} />
        </>
      ) : (
        <Segments segments={paragraph.segments} />
      )}
    </Prose>
  );
}

function noteParagraphs(row: StudyNoteRow, ord: number): NoteParagraph[] {
  const { chapter, verse } = ordToParts(ord);
  // A ranged note's own "1:1-18" lead is said by its "On 1:1–18" label instead.
  return parseNoteMarkup(isOwnNote(row, ord) ? stripOwnReference(row.text, chapter, verse) : stripLeadReference(row.text));
}

function OnRange({ row }: { row: StudyNoteRow }) {
  return (
    <Chrome step="note" tone="muted" accessibilityRole="header" style={{ fontWeight: "600", marginBottom: 4 }}>
      {onRangeLine(row)}
    </Chrome>
  );
}

const openNotes = (base: string, from: string) => router.push({ pathname: `${base}/notes`, params: { ref: from } });

/** Study notes inline, for a verse with no Yada entry: the opening, then the page (canvas SN-03). */
export function StudyNotesInline({ study, ord, from, first = false }: { study: VerseStudy; ord: number; from: string; first?: boolean }) {
  const base = useSheetBase();
  const width = useWindowDimensions().width - 44;
  const size = useType("claim").size;
  const [primary, ...around] = study.notes;
  if (primary === undefined) return null;
  const head = noteParagraphs(primary, ord);
  const opening = head[0];
  if (opening === undefined) return null;
  const more = around.length > 0 || needsMore(head, width, size);
  return (
    <Section title="Study notes" first={first}>
      <View testID="study-notes">
        {isOwnNote(primary, ord) ? null : <OnRange row={primary} />}
        <NoteParagraphText paragraph={opening} lead lines={more ? 4 : undefined} />
        {more ? <TextLink label="Read the whole note" a11yLabel="Read the whole study note" onPress={() => openNotes(base, from)} testID="study-note-more" /> : null}
      </View>
      <SourceLine style={{ marginTop: more ? 0 : 8 }} testID="study-source">{TYNDALE_SHORT}</SourceLine>
    </Section>
  );
}

/**
 * The Study notes page, pushed inside the sheet: every note on the verse, in full. Opened from a passage guide
 * ("Tyndale on 11:1–44", WM-05) it holds every note on the passage, each under the verses it is on; it opened
 * on the first verse's notes alone before.
 */
export function StudyNotesScreen({ book, ord, end = ord, from }: { book: BookCode; ord: number; end?: number; from: string }) {
  const base = useSheetBase();
  const core = useCore();
  const range = end > ord;
  const installed = useStudy((s) => s.installed[book]?.file ?? "");
  const { data: bsb } = useQuery(async () => (range ? undefined : ((await getTextsInRange(core, ord, ord))[0]?.texts["BSB"] ?? "")), [ord, range]);
  const state = useVerseStudy(book, ord, bsb);
  const { data: rangeNotes } = useQuery(async () => (range ? ((await loadRangeNotes(book, ord, end)) ?? []) : []), [book, ord, end, installed]);
  const display = range ? rangeTitle(ord, end) : formatDisplayRef(ordToParts(ord));
  const notes = range ? (rangeNotes ?? []) : state.kind === "ready" ? state.study.notes : [];
  return (
    <SheetScreen title="Study notes" subtitle={display} backLabel={display} verseId={from} testID="study-notes-page" {...UNDERSTAND_EXIT}>
      {notes.map((row, n) => (
        <View key={row.id} style={{ marginTop: n === 0 ? 0 : 20 }} testID={`study-note-${row.id}`}>
          {!range && isOwnNote(row, ord) ? null : <OnRange row={row} />}
          <View style={{ rowGap: 10 }}>
            {noteParagraphs(row, range ? row.ord_start : ord).map((p, i) => (
              <NoteParagraphText key={i} paragraph={p} lead={i === 0} />
            ))}
          </View>
          {/* "See study note on 1:24" becomes a row that opens it (edge case 2), never a dead pointer. */}
          {noteReferences(row.text, book)
            .filter((r) => !(r.start <= end && ord <= r.end))
            .map((r, i) => {
              const title = `Study note on ${rangeTitle(r.start, r.end)}`;
              return (
                <Row
                  key={`${r.start}-${r.end}`}
                  first={i === 0}
                  onPress={() => openNotes(base, formatVerseId(ordToParts(r.start)))}
                  label={spokenRange(title)}
                  testID={`note-ref-${r.start}`}
                >
                  <Chrome tone="ink" style={{ fontWeight: "500" }}>
                    {title}
                  </Chrome>
                </Row>
              );
            })}
        </View>
      ))}
      {notes.length > 0 ? (
        <SourceLine style={{ marginTop: 16 }} testID="study-source">{TYNDALE_LINE}</SourceLine>
      ) : null}
    </SheetScreen>
  );
}

/**
 * People and places named in the verse, first in the sheet (canvas TD-01: who someone is comes before what a
 * note says; PD-01). Several are one line of names in the verse's order, accent, each a 44 pt target, with
 * rows at AX sizes where a line of names would break apart; one alone is a row with its line (TD-01).
 */
export function PeopleAndPlaces({ people, book, ord, bsb, from, first }: { people: readonly StudyNoteRow[]; book: BookCode; ord: number; bsb: string; from: string; first: boolean }) {
  const base = useSheetBase();
  const palette = usePalette();
  const { ax } = useLayout();
  const { data: places } = useQuery(() => loadVersePlaces(book, ord), [book, ord]);
  const named = namedInVerse(bsb, people, places ?? []);
  if (named.length === 0) return null;
  const open = (n: Named) =>
    n.kind === "person"
      ? router.push({ pathname: `${base}/person`, params: { book, id: n.id, from } })
      : router.push({ pathname: `${base}/place`, params: { book, id: n.id, from: String(ord) } });
  const lineOf = (n: Named) => (n.kind === "place" ? "Place" : (whoLine(n.name, people.find((p) => String(p.id) === n.id)?.text ?? "") ?? "Person"));
  return (
    <Section title="People and places" first={first}>
      {named.length > 1 && !ax ? (
        <View style={styles.names} testID="people-line">
          {named.map((n, i) => (
            <View key={`${n.kind}-${n.id}`} style={styles.nameSlot}>
              {i > 0 ? <Chrome tone="muted">{" · "}</Chrome> : null}
              <Pressable onPress={() => open(n)} accessibilityRole="button" accessibilityLabel={`${n.name}, ${n.kind}`} style={({ pressed }) => [styles.name, pressed ? { opacity: 0.6 } : null]} testID={`named-${n.id}`}>
                <Chrome style={{ color: palette.accent, fontWeight: "600" }}>{n.name}</Chrome>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        named.map((n, i) => (
          <Row key={`${n.kind}-${n.id}`} first={i === 0} onPress={() => open(n)} label={`${n.name}, ${lineOf(n)}`} testID={n.kind === "person" ? `person-${n.id}` : `named-${n.id}`}>
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {n.name}
            </Chrome>
            <RowNote>{lineOf(n)}</RowNote>
          </Row>
        ))
      )}
    </Section>
  );
}

/**
 * A Tyndale profile, pushed inside the sheet (canvas TD-02): its paragraphs, then rows from its
 * own "Passages for Further Study" line, then the credit. From Search the footer says "Back to
 * search", as the peek does.
 */
export function ProfileScreen({ book, id, from, via }: { book: BookCode; id: number; from: string; via?: string }) {
  const { jumpTo } = useSheetNav();
  const { data } = useQuery(() => loadProfile(book, id), [book, id]);
  const fromRef = parseVerseId(from);
  const fromDisplay = fromRef === null ? undefined : formatDisplayRef(fromRef);
  const title = data?.title ?? "";
  const body = data === undefined || data === null ? null : profileBody(data.text, title);
  const spans = body === null || body.further === null ? [] : parseFurtherStudy(body.further, book);
  const search = via === "search";
  return (
    <SheetScreen
      title={title}
      subtitle={fromDisplay}
      backLabel={fromDisplay ?? null}
      verseId={from}
      backText={search ? "Back to search" : undefined}
      testID="person"
      // From Search the sheet keeps its footer back to the results; from Understand × is the way back.
      {...(search ? { closeLabel: "Close" } : UNDERSTAND_EXIT)}
    >
      {body !== null ? (
        <View style={{ rowGap: 12 }}>
          {body.paragraphs.map((p, i) => (
            <NoteParagraphText key={i} paragraph={p} lead={false} />
          ))}
        </View>
      ) : null}
      {spans.length > 0 && data !== undefined && data !== null ? (
        <Section title={readAboutLabel(title, data.text)}>
          {spans.map((s, i) => {
            const target = ordToParts(s.start);
            const label = rangeTitle(s.start, s.end);
            return (
              <Row
                key={`${s.start}-${s.end}`}
                first={i === 0}
                onPress={() => jumpTo({ book: target.book, chapter: target.chapter, verse: target.verse, from: from === "" ? undefined : from, select: true })}
                label={spokenRange(label)}
                hint="Opens the passage"
                testID={`read-about-${s.start}`}
              >
                <Chrome tone="ink" style={{ fontWeight: "500" }}>
                  {label}
                </Chrome>
              </Row>
            );
          })}
        </Section>
      ) : null}
      {body !== null ? (
        <SourceLine style={{ marginTop: 16 }} testID="profile-source">{body.shortened ? TYNDALE_SHORTENED : TYNDALE_SHORT}</SourceLine>
      ) : null}
    </SheetScreen>
  );
}

/** A See also row with the words its second line shows, in the version they are shown in. */
export type ShownSeeAlso = SeeAlsoItem & { readonly text: string | null; readonly translation: string };

/**
 * See also's rows with their verse text (edge cases 4 and 5): OpenBible's in the reader's own
 * version when it is built in or downloaded, BSB under a licensed one (display-only, never
 * looked up here). A target that version does not print (John 5:4, Acts 8:37 in some), or one
 * outside the English numbering (3 John 1:15), is left out rather than shown empty. Yada's own
 * rows carry their note instead. Empty until the texts are read, so counts never jump.
 */
export function useShownSeeAlso(items: readonly SeeAlsoItem[]): ShownSeeAlso[] {
  const core = useCore();
  const reading = useSettings((s) => s.translation);
  const code = isTranslation(reading) || isDownloaded(reading) ? reading : "BSB";
  const key = items.map((i) => `${i.source}:${i.start}-${i.end}`).join(",");
  const { data } = useQuery(async () => {
    const out: ShownSeeAlso[] = [];
    for (const item of items) {
      if (item.source === "yada") {
        out.push({ ...item, text: null, translation: code });
        continue;
      }
      const text = (await getTexts(core, item.start))[code];
      if (text !== undefined && text.trim() !== "") out.push({ ...item, text, translation: code });
    }
    return out;
  }, [key, code]);
  return data ?? [];
}

/** One See also row; the whole row opens the passage in the reader with a way back (SN-07). */
export function SeeAlsoRow({ item, from, first, ax }: { item: ShownSeeAlso; from: string; first: boolean; ax: boolean }) {
  const { jumpTo } = useSheetNav();
  const text = item.text;
  const title = rangeTitle(item.start, item.end);
  const second: ReactNode =
    item.source === "yada" ? (
      item.note === null ? null : (
        <Prose step="note" tone="muted">
          {item.note}
        </Prose>
      )
    ) : text === null ? null : (
      // Canvas SN-03, SN-08 (`.xt`): the verse in full, as a reference row shows it; only AX sizes
      // cap it, so one row never fills the screen.
      <Scripture step="claim" tone="muted" numberOfLines={ax ? 4 : undefined} style={{ fontFamily: FONTS.scripture }}>
        <DivineText text={text} translation={item.translation} />
      </Scripture>
    );
  const spokenSecond = item.source === "yada" ? (item.note ?? "") : (text ?? "");
  const target = ordToParts(item.start);
  const last = ordToParts(item.end);
  const to = last.book === target.book && last.chapter === target.chapter ? last.verse : undefined;
  return (
    <Row
      first={first}
      onPress={() => jumpTo({ book: target.book, chapter: target.chapter, verse: target.verse, to, from, select: true })}
      label={[spokenRange(title), spokenSecond].filter((s) => s !== "").join(". ")}
      hint="Opens the passage"
      testID={`see-also-${item.start}`}
    >
      {/* `.row.xr .xref`: weight 500, like every other row name in Understand. */}
      <Chrome tone="ink" style={{ fontWeight: "500" }}>
        {title}
      </Chrome>
      {second}
    </Row>
  );
}

/** See also inline, for a verse with no Yada entry: three, then Show all (canvas SN-03). */
export function SeeAlsoSection({ items, from, ax, first = false }: { items: readonly ShownSeeAlso[]; from: string; ax: boolean; first?: boolean }) {
  const base = useSheetBase();
  if (items.length === 0) return null;
  const shown = items.slice(0, SEE_ALSO_FIRST);
  const more = items.length > SEE_ALSO_FIRST;
  return (
    <Section title="See also" first={first}>
      {shown.map((item, i) => (
        <SeeAlsoRow key={`${item.source}-${item.start}-${item.end}`} item={item} from={from} first={i === 0} ax={ax} />
      ))}
      {more ? (
        <TextLink
          label={`Show all ${items.length}`}
          a11yLabel={`Show all ${items.length} passages`}
          onPress={() => router.push({ pathname: `${base}/see-also`, params: { ref: from } })}
          testID="see-also-all"
        />
      ) : null}
      {shown.some((item) => item.source === "openbible") ? (
        <SourceLine style={{ marginTop: more ? 0 : 8 }} testID="openbible-source">{OPENBIBLE_LINE}</SourceLine>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  // PD-01 `.ppl`/`.ppn`: names wrap as a line; each is its own 44 pt target.
  names: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  nameSlot: { flexDirection: "row", alignItems: "center" },
  name: { minHeight: 44, justifyContent: "center" },
  failed: { flexDirection: "row", alignItems: "center", columnGap: 12 },
  failedAx: { alignItems: "flex-start", rowGap: 8 },
});

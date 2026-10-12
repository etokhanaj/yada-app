/**
 * Everything one passage guide shows, read in one go (no screen shows a
 * loading state for its own data, brief: no skeletons in reading).
 */

import { BOOK_CODES, type BookCode, type Claim, formatVerseId, ordToParts, parseVerseRef, verseOrd } from "@yada/schema";

import { firstSentence, GUIDE_PICKS, type GuideToken, guideFields, pickClaims, showsPericopeText } from "../lib/guide";
import type { PericopeRow } from "../lib/pericopes";
import { rangeInBook } from "../lib/saved";
import { bsbStandsIn, verseTextIn } from "../lib/translations";
import { loadPassageNote, type PassageNote } from "./passageNote";
import { countInBook, type Db, getLexeme, getTextsInRange, getTokens, isDownloaded } from "./queries";
import { isUnreviewed, loadEntry, loadPericopes, parsePericopePayload } from "./understand";

export interface GuideVerse {
  readonly ord: number;
  readonly verse: number;
  readonly chapter: number;
  readonly verseId: string;
  readonly text: string;
}

export interface GuideCloser {
  readonly surface: string;
  readonly translit: string;
  readonly gloss: string | null;
  readonly occurrenceKey: string;
  readonly inBook: number;
}

export interface GuideData {
  readonly pericope: PericopeRow;
  readonly book: BookCode;
  /** "1:1–18", "15:18–16:4" */
  readonly range: string;
  /** "John 1:1–18" */
  readonly title: string;
  readonly next: { readonly pericope: PericopeRow; readonly range: string } | null;
  /** The verse entry a full guide is built from; Understand's own pushes and evidence use it. */
  readonly entryVerseId: string | null;
  readonly unreviewed: boolean;
  readonly whereWeAre: string | null;
  readonly moves: readonly string[];
  readonly notice: readonly Claim[];
  readonly differ: readonly Claim[];
  readonly closer: { readonly claim: string; readonly word: GuideCloser } | null;
  /** The opener when the passage has no Yada content: Tyndale's note, through package A's hook. */
  readonly note: PassageNote | null;
  readonly verses: readonly GuideVerse[];
  /** The text is the BSB's, standing in for a licensed version (display only, rule 9). */
  readonly shownInBsb: boolean;
  /** Evidence words can be marked: the text shown is the BSB's, which the entries were written against. */
  readonly bsbText: boolean;
  /** Greek tokens per cited verse ord, for evidence marks. */
  readonly tokens: ReadonlyMap<number, readonly GuideToken[]>;
}

/** The verse ids a guide's claims cite inside its passage: their tokens are read once, for marking. */
function citedOrds(claims: readonly Claim[], lo: number, hi: number): number[] {
  const out = new Set<number>();
  for (const c of claims) {
    for (const e of c.evidence) {
      if (e.type !== "verse") continue;
      const r = parseVerseRef(e.ref);
      if (r === null || r.start.chapter !== r.end.chapter || r.start.verse !== r.end.verse) continue;
      const ord = verseOrd(r.book, r.start.chapter, r.start.verse);
      if (ord >= lo && ord <= hi) out.add(ord);
    }
  }
  return [...out];
}

export async function loadGuide(core: Db, pericopeId: string, translation: string): Promise<GuideData | null> {
  const range = parseVerseRef(pericopeId);
  if (range === null) return null;
  const book = range.book;
  const pericopes = await loadPericopes(book);
  const index = pericopes.findIndex((p) => p.pericope_id === pericopeId);
  const pericope = pericopes[index];
  if (pericope === undefined) return null;
  const following = pericopes[index + 1];

  const downloaded = isDownloaded(translation);
  const rows = await getTextsInRange(core, pericope.start_ord, pericope.end_ord);
  // Edge cases decided 11 Oct 2026: the reader's own translation when it is built in or
  // downloaded; a licensed one falls back to the BSB, and says so (display only, rule 9).
  const shownInBsb = rows.some((r) => bsbStandsIn(r.texts, translation, downloaded));
  const verses: GuideVerse[] = rows
    .filter((r) => r.ord % 1000 !== 0)
    .map((r) => {
      const p = ordToParts(r.ord);
      return { ord: r.ord, verse: p.verse, chapter: p.chapter, verseId: formatVerseId(p), text: verseTextIn(r.texts, translation, downloaded) ?? "" };
    })
    .filter((v) => v.text !== "");

  const payload = parsePericopePayload(pericope);
  const fields = guideFields(pericope.payload);
  const pick = GUIDE_PICKS[pericopeId];
  const loaded = pick === undefined ? null : await loadEntry(book, pick.entry);
  const claims = loaded?.entry.claims ?? [];
  const notice = pick === undefined ? [] : pickClaims(claims, pick.notice);
  const differ = pick === undefined ? [] : pickClaims(claims, pick.differ);

  const bsbText = translation === "BSB" || shownInBsb;
  const tokens = new Map<number, readonly GuideToken[]>();
  for (const ord of citedOrds(notice, pericope.start_ord, pericope.end_ord)) {
    tokens.set(ord, (await getTokens(core, ord)).words);
  }

  let closer: GuideData["closer"] = null;
  if (pick?.closer !== undefined && loaded !== null) {
    const entryOrd = rows.find((r) => formatVerseId(ordToParts(r.ord)) === pick.entry)?.ord;
    const words = entryOrd === undefined ? [] : (await getTokens(core, entryOrd)).words;
    // Any verse of the passage holding the lemma: 1 Cor 14:34's σιγάω is in the verse itself.
    const token = words.find((w) => w.lemma === pick.closer?.lemma);
    const lexeme = token === undefined ? null : await getLexeme(core, token.occurrenceKey);
    if (token !== undefined && lexeme !== null) {
      closer = {
        claim: pick.closer.claim,
        word: {
          surface: lexeme.lemma,
          translit: lexeme.translit,
          gloss: lexeme.gloss,
          occurrenceKey: lexeme.occurrenceKey,
          inBook: await countInBook(core, book, lexeme.occurrenceKey),
        },
      };
    }
  }

  const whereWeAre =
    fields.orientation ?? (loaded !== null ? firstSentence(loaded.entry.whats_happening) : (payload?.summary_one_sentence ?? null));
  const moves = fields.moves ?? payload?.movement?.map((m) => m.label) ?? [];
  // A guide with Yada content opens with it; only the fallback guide asks for a study note.
  const note =
    loaded === null && whereWeAre === null
      ? await loadPassageNote({ book, pericopeId, startOrd: pericope.start_ord, endOrd: pericope.end_ord })
      : null;

  return {
    pericope,
    book,
    range: rangeInBook(pericopeId),
    title: `${BOOK_CODES[book].name} ${rangeInBook(pericopeId)}`,
    next: following === undefined ? null : { pericope: following, range: rangeInBook(following.pericope_id) },
    entryVerseId: loaded === null ? null : (pick?.entry ?? null),
    unreviewed:
      (loaded !== null && isUnreviewed(loaded.reviewStatus)) ||
      (showsPericopeText(payload !== null, fields) && isUnreviewed(pericope.review_status)),
    whereWeAre,
    moves,
    notice,
    differ,
    closer,
    note,
    verses,
    shownInBsb,
    bsbText,
    tokens,
  };
}

/**
 * The one line Start here shows under its Next passage (PG-06): the guide's
 * Where we are, shown whole, or nothing when the passage has none.
 *
 * Reviewed text only. The row has no room for the Unreviewed label, so a draft shows
 * nothing here and keeps its label in the guide (rule 2; gate review, 11 Oct 2026).
 */
export async function loadOrientation(pericope: PericopeRow): Promise<string | null> {
  const pericopeReviewed = !isUnreviewed(pericope.review_status);
  const fields = guideFields(pericope.payload);
  if (fields.orientation !== undefined) return pericopeReviewed ? fields.orientation : null;
  const pick = GUIDE_PICKS[pericope.pericope_id];
  const range = parseVerseRef(pericope.pericope_id);
  if (pick !== undefined && range !== null) {
    const loaded = await loadEntry(range.book, pick.entry);
    if (loaded !== null) return isUnreviewed(loaded.reviewStatus) ? null : firstSentence(loaded.entry.whats_happening);
  }
  return pericopeReviewed ? (parsePericopePayload(pericope)?.summary_one_sentence ?? null) : null;
}

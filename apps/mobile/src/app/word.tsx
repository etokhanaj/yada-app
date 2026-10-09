/**
 * The word card: the reader-dictionary pattern — tiny tracked label, large
 * headword, then what the sources say about it — without the bordered panels
 * dictionary apps wrap it in. Every line names its source; nothing
 * here is generated (handoff §3.4: never state a parse or Strong's number the
 * source data does not contain). Presented as a page sheet; see _layout.tsx
 * for why not the part-height Look Up sheet.
 */

import {
  BOOK_CODES,
  describeHebrewMorph,
  formatDisplayRef,
  morphLine,
  ordToParts,
  parseVerseId,
} from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { DraftLabel, Hairline, LinkRow, Section, SheetScreen } from "../components/Sheet";
import { Label, Original, Prose } from "../components/Type";
import { useCore, useLog, useQuery } from "../data/AppData";
import { countInBook, getLexeme, getToken, scriptOf } from "../data/queries";
import { isUnreviewed, loadEntry } from "../data/understand";
import { SPACE } from "../design/tokens";

export default function WordScreen() {
  const params = useLocalSearchParams<{ ord?: string; pos?: string; from?: string }>();
  const ord = Number(params.ord);
  const position = Number(params.pos);
  const from = params.from ?? "";
  const fromRef = parseVerseId(from);
  const core = useCore();
  const log = useLog();

  const { data } = useQuery(async () => {
    const token = await getToken(core, ord, position);
    if (token === null) return null;
    const parts = ordToParts(ord);
    const [lexeme, inBook, loaded] = await Promise.all([
      getLexeme(core, token.occurrenceKey),
      countInBook(core, parts.book, token.occurrenceKey),
      loadEntry(parts.book, `${parts.book}.${parts.chapter}.${parts.verse === 0 ? 1 : parts.verse}`),
    ]);
    const keyWord =
      loaded?.entry.key_words.find((k) => k.surface === token.surface || (token.strongs !== null && k.strongs === token.strongs)) ??
      null;
    return { token, lexeme, inBook, keyWord, reviewStatus: loaded?.reviewStatus ?? null };
  }, [ord, position]);

  useEffect(() => {
    if (data?.token !== undefined) log("word_open", from, data.token.occurrenceKey);
  }, [log, from, data?.token]);

  const backLabel = fromRef === null ? null : formatDisplayRef(fromRef);
  if (data === undefined || data === null) return <SheetScreen backLabel={backLabel}>{null}</SheetScreen>;

  const { token, lexeme, inBook, keyWord, reviewStatus } = data;
  const parts = ordToParts(ord);
  const book = parts.book;
  const script = scriptOf(book);
  const language = script === "hebrew" ? (token.morph.startsWith("A") ? "Aramaic" : "Hebrew") : "Greek";
  const parseSource = script === "greek" ? "MorphGNT" : "Open Scriptures Hebrew Bible";
  const where = formatDisplayRef(parts);

  return (
    <SheetScreen backLabel={backLabel} verseId={from}>
      <Label accessibilityRole="header">
        Original {language} · {where}
      </Label>
      <Original script={script} step="headword" style={{ marginTop: SPACE.sm }} testID="word-headword">
        {token.surface}
      </Original>
      <Prose step="claim" style={{ marginTop: SPACE.xs }}>
        {token.translit}
        {token.gloss === null ? "" : ` · “${token.gloss}”`}
      </Prose>
      {token.glossSource !== null ? (
        <Prose step="note" tone="muted">
          Gloss from {token.glossSource}
        </Prose>
      ) : null}

      <Section title="Form">
        <Prose step="claim" testID="word-morph">
          {morphLine(token.morph)}
        </Prose>
        {token.morphemes !== undefined && token.morphemes.length > 1 ? (
          <View style={{ marginTop: SPACE.sm }}>
            {token.morphemes.map((m, index) => {
              const description =
                m.morph === undefined
                  ? ""
                  : describeHebrewMorph(`${token.morph[0] ?? "H"}${m.morph}`)
                      .map((p) => (p.detail === "" ? p.partOfSpeech : `${p.partOfSpeech}, ${p.detail}`))
                      .join(" + ");
              return (
                <View key={index} style={{ flexDirection: "row", alignItems: "baseline", columnGap: SPACE.md, marginTop: SPACE.xs }}>
                  <Original script="hebrew" step="claim" style={{ minWidth: 48, textAlign: "right" }}>
                    {m.surface}
                  </Original>
                  <Prose step="note" style={{ flex: 1 }}>
                    {m.gloss === undefined ? "" : `“${m.gloss}” · `}
                    {description}
                  </Prose>
                </View>
              );
            })}
          </View>
        ) : null}
        <Label style={{ marginTop: SPACE.sm }}>Parsing: {parseSource}</Label>
        {token.variantMarked ? (
          <Prose step="note" tone="muted" style={{ marginTop: SPACE.xs }}>
            The base text marks a variant reading at this word.
          </Prose>
        ) : null}
      </Section>

      {lexeme !== null ? (
        <Section title="Dictionary form">
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: SPACE.sm }}>
            <Original script={script} step="explanation">
              {lexeme.lemma}
            </Original>
            <Prose step="claim">{lexeme.translit}</Prose>
            {lexeme.strongs !== null ? (
              <Prose step="claim" tone="muted" testID="word-strongs">
                {lexeme.strongs}
              </Prose>
            ) : null}
          </View>
          {lexeme.gloss !== null ? (
            <Prose step="note" tone="muted" style={{ marginTop: SPACE.xs }}>
              Usually glossed “{lexeme.gloss}” — the commonest of its word-for-word glosses in the STEPBible alignment data.
            </Prose>
          ) : null}
        </Section>
      ) : null}

      {keyWord?.note !== undefined ? (
        <Section title="From the explanation">
          {isUnreviewed(reviewStatus) ? <DraftLabel /> : null}
          <Prose step="claim" style={{ marginTop: SPACE.xs }}>
            {keyWord.note}
          </Prose>
        </Section>
      ) : null}

      <Hairline />
      <Prose step="claim" testID="word-counts">
        {inBook} in {BOOK_CODES[book].name}
        {lexeme === null ? "" : ` · ${lexeme.total} in the Bible`}
      </Prose>
      <LinkRow
        label={`See occurrences in ${BOOK_CODES[book].name} ›`}
        onPress={() =>
          router.push({ pathname: "/occurrences", params: { key: token.occurrenceKey, book, from } })
        }
        testID="see-occurrences"
      />
    </SheetScreen>
  );
}

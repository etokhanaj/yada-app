/**
 * The word card (J01-07, JN-05, GN-04). Big serif headword (Vocabulary,
 * https://mobbin.com/screens/935d4833-e999-4cb0-92df-033c996fc00d), facts as
 * label and value (Fable dictionary). The header names the layer, `Word`, and
 * its verse; the word itself is said once, as the headword (v2-review S1).
 *
 * Every line names its source; nothing here is generated except `In this
 * verse`, which is the entry's own note (rule 4: never state a parse or
 * Strong's number the source data does not contain). Hebrew aligns to the
 * trailing edge (brief §5).
 */

import { BOOK_CODES, describeHebrewMorph, formatDisplayRef, morphLine, ordToParts, parseVerseId } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { Row, Section, SheetScreen } from "../../components/Sheet";
import { Chrome, Original, Prose } from "../../components/Type";
import { useCore, useLog, useQuery } from "../../data/AppData";
import { countInBook, getLexeme, getToken, scriptOf } from "../../data/queries";
import { isUnreviewed, loadEntry } from "../../data/understand";
import { useLayout, usePalette } from "../../design/tokens";
import { displayGloss } from "../../lib/glosses";
import { useSheets } from "../../state/sheets";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function WordScreen() {
  const params = useLocalSearchParams<{ ord?: string; pos?: string; from?: string; via?: string }>();
  const ord = Number(params.ord);
  const position = Number(params.pos);
  const from = params.from ?? "";
  const fromRef = parseVerseId(from);
  const core = useCore();
  const log = useLog();
  const palette = usePalette();
  const { ax } = useLayout();

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
      loaded?.entry.key_words.find((k) => k.surface === token.surface || (token.strongs !== null && k.strongs === token.strongs)) ?? null;
    return { token, lexeme, inBook, keyWord, reviewStatus: loaded?.reviewStatus ?? null };
  }, [ord, position]);

  useEffect(() => {
    if (data?.token !== undefined) log("word_open", from, data.token.occurrenceKey);
  }, [log, from, data?.token]);
  // The interlinear behind marks this word while its card is open.
  useEffect(() => () => useSheets.getState().setOpenWord(null), []);

  const parts = ordToParts(ord);
  const where = formatDisplayRef(parts.verse === 0 ? { ...parts, verse: 1 } : parts);
  const backLabel = fromRef === null ? null : formatDisplayRef(fromRef);
  const shell = (children: React.ReactNode) => (
    <SheetScreen
      title="Word"
      subtitle={where}
      // Only "In this verse" is generated; everything else is source data.
      unreviewed={data?.keyWord?.note !== undefined && data?.keyWord !== null && isUnreviewed(data?.reviewStatus)}
      backLabel={backLabel}
      verseId={from}
      backText={params.via === "search" ? "Back to search" : undefined}
      closeLabel={params.via === "search" ? "Close" : "Back to Understand"}
      testID="word"
    >
      {children}
    </SheetScreen>
  );
  if (data === undefined || data === null) return shell(null);

  const { token, lexeme, inBook, keyWord } = data;
  const book = parts.book;
  const script = scriptOf(book);
  const rtl = script === "hebrew";
  const parseSource = rtl ? "OSHB" : "MorphGNT";
  const align = rtl ? ({ textAlign: "right" } as const) : null;

  return shell(
    <>
      <Original
        script={script}
        step="headword"
        // DP-06: 1.5× the headword token at default size; at AX sizes the token as it was.
        style={[{ marginTop: 4 }, ax ? null : { fontSize: 60, lineHeight: rtl ? 92 : 70 }, rtl ? { textAlign: "right" } : null, ax && rtl ? { lineHeight: 64 } : null]}
        {...(ax ? {} : { maxFontSizeMultiplier: 1 })}
        accessibilityLabel={token.surface}
        testID="word-headword"
      >
        {token.surface}
      </Original>
      <Prose step="claim" tone="muted" style={[{ marginTop: 6 }, align]}>
        {token.translit}
        {token.gloss === null ? "" : ` · ${displayGloss(token.gloss)}`}
      </Prose>

      <Section title="Form">
        <Prose step="claim" testID="word-morph">
          {capitalise(morphLine(token.morph))}
        </Prose>
        {token.variantMarked ? (
          <Prose step="note" tone="muted" style={{ marginTop: 4 }}>
            The base text marks a variant reading at this word.
          </Prose>
        ) : null}
      </Section>

      {token.morphemes !== undefined && token.morphemes.length > 1 ? (
        <Section title="Parts">
          {token.morphemes.map((m, index) => {
            const description =
              m.morph === undefined
                ? ""
                : describeHebrewMorph(`${token.morph[0] ?? "H"}${m.morph}`)
                    .map((p) => p.partOfSpeech)
                    .join(" + ");
            return (
              <View
                key={index}
                accessible
                accessibilityLabel={`${m.gloss === undefined ? "" : displayGloss(m.gloss)}, ${m.role}${description === "" ? "" : `, ${description}`}`}
                style={[
                  { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", columnGap: 12, paddingVertical: 10 },
                  index > 0 ? { boxShadow: `0 -1px 0 ${palette.divider}` } : null,
                ]}
              >
                <Prose step="claim" style={{ flexShrink: 1 }}>
                  {m.gloss === undefined ? "" : displayGloss(m.gloss)}
                  <Prose step="note" tone="muted">
                    {"  ·  "}
                    {m.role}
                  </Prose>
                </Prose>
                <Original script="hebrew" step="original">
                  {m.surface}
                </Original>
              </View>
            );
          })}
        </Section>
      ) : null}

      {lexeme !== null ? (
        <Section title="Dictionary form">
          <Prose step="claim">
            <Prose step="claim" style={{ fontFamily: rtl ? "NotoSerifHebrew" : "GentiumPlus" }}>
              {lexeme.lemma}
            </Prose>
            {` · ${lexeme.translit}`}
            {lexeme.strongs === null ? "" : ` · ${lexeme.strongs}`}
          </Prose>
          {lexeme.gloss !== null ? (
            <Prose step="note" tone="muted" style={{ marginTop: 2 }}>
              Usually “{lexeme.gloss}”.
            </Prose>
          ) : null}
        </Section>
      ) : null}

      {keyWord?.note !== undefined ? (
        <Section title="In this verse">
          <Prose step="claim">{keyWord.note}</Prose>
        </Section>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <Row
          first
          onPress={() => router.push({ pathname: "/evidence/occurrences", params: { key: token.occurrenceKey, book, from } })}
          testID="see-occurrences"
        >
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            {inBook} {inBook === 1 ? "time" : "times"} in {BOOK_CODES[book].name}
          </Chrome>
        </Row>
        {lexeme !== null ? (
          <Row onPress={() => router.push({ pathname: "/evidence/in-bible", params: { key: token.occurrenceKey, from } })} testID="see-all-occurrences">
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {lexeme.total} in the Bible
            </Chrome>
          </Row>
        ) : null}
      </View>

      <Prose step="note" tone="muted" style={{ marginTop: 12 }}>
        {token.glossSource === null ? "" : `Gloss: ${token.glossSource} · `}Parsing: {parseSource}
      </Prose>
    </>,
  );
}

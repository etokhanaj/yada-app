/**
 * Compare (build plan Phase 3; canvas CP-01–09, MM-10): yours first, then each version against yours,
 * with one line of what it words differently ("has not → hasn’t · 1 more change"), never a wash of marks.
 *
 * - The reader's own version is "yours" and the base, a licensed one included (CP-07). If it can't load,
 *   the BSB stands in and says so; the choice is kept.
 * - Up to three others, chosen inside Compare (CP-06); by default the first three on the phone.
 * - The Message is shown whole and unmarked, with one line saying why (CP-09).
 * - A version without the verse says so; nothing becomes the base in its place (CP-08).
 * - When every version words it the same, the rows fold into one block (MM-10); punctuation never counts.
 *
 * Licensed text is display-only: compared here on the phone and nowhere else (CLAUDE.md rule 9).
 */

import { formatVerseId, ordToParts } from "@yada/schema";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { View } from "react-native";

import { Row, RowNote, SheetScreen } from "../../components/Sheet";
import { Chrome, Label, Prose, Scripture } from "../../components/Type";
import { DivineText } from "../../components/Verse";
import { useAppData, useCore, useQuery } from "../../data/AppData";
import { isLicensedCode } from "../../data/licensed";
import { BUILT_IN, getTextsInRange, readableTranslations } from "../../data/queries";
import { useTranslations } from "../../data/translations";
import { licensedCodes, licensedEnabled, loadLicensedVerses } from "../../data/useLicensedChapter";
import { useLayout } from "../../design/tokens";
import { formatRange, resolveRef } from "../../lib/chapters";
import { compareSelection, listAnd } from "../../lib/compare";
import { changeLine, changeText, hasRealDivergence } from "../../lib/diff";
import { spokenText } from "../../lib/supplied";
import { notInLine, onPhoneOrder } from "../../lib/translations";
import { useSettings } from "../../state/settings";

/** A paraphrase is not marked word by word (CP-09). */
const PARAPHRASES = new Set(["MSG"]);

export default function CompareScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const span = resolveRef(params.ref ?? "");
  const core = useCore();
  const { user } = useAppData();
  const { sectionGap } = useLayout();
  const reading = useSettings((s) => s.translation);
  const compareWith = useSettings((s) => s.compareWith);
  const installed = useTranslations((s) => s.installed);
  const available = [...onPhoneOrder(BUILT_IN, installed.map((t) => t.code)), ...(licensedEnabled() ? licensedCodes() : [])];
  const others = compareSelection(reading, available, compareWith);

  const navigation = useNavigation();
  const { data } = useQuery(async () => {
    if (span === null) return null;
    const verses = await getTextsInRange(core, span.startOrd, span.endOrd);
    const chapters = [...new Set(verses.map((v) => ordToParts(v.ord).chapter))];
    const licensed = new Map<string, { texts: Map<number, string>; available: boolean; copyright: string | null }>();
    for (const code of [reading, ...others]) {
      if (isLicensedCode(code)) licensed.set(code, await loadLicensedVerses(user, code, span.book, chapters));
    }
    return { verses, licensed };
  }, [params.ref, reading, others.join(",")]);

  const label = span === null ? "" : formatRange(params.ref ?? "");
  // Opened from the reader's bar, Compare is the sheet's first page and no Understand is underneath (IA stress test).
  const openedFirst = (navigation.getState()?.index ?? 0) === 0;
  const firstId = span === null ? "" : formatVerseId(ordToParts(span.startOrd));
  const shell = (children: React.ReactNode) => (
    <SheetScreen title="Compare" subtitle={label} backLabel={label} verseId={firstId} closeLabel={openedFirst ? "Close, back to reading" : "Back to Understand"} testID="translations">
      <Row
        first
        onPress={() => router.push({ pathname: "/evidence/choose", params: { ref: params.ref ?? "" } })}
        label={`Translations, ${listAnd([reading, ...others])}`}
        testID="compare-choose"
      >
        <Chrome tone="ink" style={{ fontWeight: "500" }}>
          Translations
        </Chrome>
        <RowNote>{[reading, ...others].join(" · ")}</RowNote>
      </Row>
      <View style={{ marginTop: sectionGap }}>{children}</View>
    </SheetScreen>
  );
  if (data === undefined || data === null || span === null) return shell(null);

  const textOf = (code: string, ord: number, texts: Readonly<Partial<Record<string, string>>>): string =>
    isLicensedCode(code) ? (data.licensed.get(code)?.texts.get(ord) ?? "") : (texts[code] ?? "");
  const yoursDown = isLicensedCode(reading) && data.licensed.get(reading)?.available !== true;
  // CP-07: if your licensed version can't load, the BSB stands in as the base and says so.
  const base = yoursDown ? "BSB" : reading;
  const compared = [base, ...others.filter((c) => c !== base)];
  const readable = [...readableTranslations(), ...data.licensed.keys()];
  const multi = data.verses.length > 1;
  const copyrights = [...data.licensed.values()].flatMap((l) => (l.available && l.copyright !== null ? [l.copyright] : []));

  const all = compared.map((c) => data.verses.map((v) => textOf(c, v.ord, v.texts)).join(" ").trim());
  const present = compared.filter((_, i) => all[i] !== "");
  const agree = present.length >= 2 && present.length === compared.length && !hasRealDivergence(all);

  if (agree) {
    // MM-10: the rows fold into one block, the verse once and one line naming who agrees.
    return shell(
      <View testID="translations-agree">
        <Scripture step="explanation" accessibilityLabel={spokenText(all[0] ?? "", base)}>
          <DivineText text={all[0] ?? ""} translation={base} />
        </Scripture>
        <Prose step="claim" tone="muted" style={{ marginTop: 10 }}>
          {`${listAnd(present)} agree here.`}
        </Prose>
      </View>,
    );
  }

  return shell(
    <>
      {yoursDown ? (
        <Prose step="claim" tone="muted" style={{ marginBottom: 12 }} testID="compare-yours-down">
          {`The ${reading} needs a connection, so the others are compared with the BSB.`}
        </Prose>
      ) : null}
      {data.verses.map((v, vi) => {
        const yours = textOf(base, v.ord, v.texts);
        const parts = ordToParts(v.ord);
        return (
          <View key={v.ord} style={{ marginTop: vi === 0 ? 0 : sectionGap }}>
            {multi ? <Label style={{ marginBottom: 8 }}>{`${parts.chapter}:${parts.verse}`}</Label> : null}
            {compared.map((code, i) => {
              const text = textOf(code, v.ord, v.texts);
              // A licensed version that didn't load is not "not in" anything (review, 12 Oct 2026).
              const down = isLicensedCode(code) && data.licensed.get(code)?.available !== true;
              const missing = text === "" && readable.includes(code) && !down;
              const paraphrase = PARAPHRASES.has(code);
              const line = i === 0 || text === "" || yours === "" || paraphrase ? "" : changeText(changeLine(yours, text));
              const name = i === 0 ? `${code} · yours` : code === "MSG" ? "The Message" : code;
              return (
                <View key={code} style={{ marginTop: i === 0 ? 0 : 18 }} testID={`compare-${code}`}>
                  <Label accessibilityLabel={i === 0 ? `${code}, your translation` : name} style={{ marginBottom: 4 }}>
                    {name}
                  </Label>
                  {down ? (
                    <Prose step="claim" tone="muted">
                      {`The ${code} needs a connection.`}
                    </Prose>
                  ) : missing ? (
                    <Prose step="claim" tone="muted">
                      {notInLine(code)}
                    </Prose>
                  ) : (
                    <Scripture step="explanation" accessibilityLabel={spokenText(text, code)}>
                      <DivineText text={text} translation={code} />
                    </Scripture>
                  )}
                  {line !== "" ? (
                    <Chrome step="note" tone="muted" style={{ marginTop: 4 }}>
                      {line}
                    </Chrome>
                  ) : null}
                  {paraphrase && i > 0 && text !== "" ? (
                    <Chrome step="note" tone="muted" style={{ marginTop: 4 }}>
                      A paraphrase, so it isn’t marked word by word.
                    </Chrome>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
      {copyrights.map((c) => (
        // API.Bible §7: each licensed version's notice, verbatim, under its words.
        <Chrome key={c} step="note" tone="muted" style={{ marginTop: sectionGap }}>
          {c}
        </Chrome>
      ))}
    </>,
  );
}

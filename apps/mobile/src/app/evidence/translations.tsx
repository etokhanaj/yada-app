/**
 * Compare (build plan Phase 3; canvas CP-01–09, after YouVersion's compare, 15 Oct 2026): yours on top, then
 * each version against yours, its differing words marked and one line of what it words differently
 * ("has not → hasn’t · 1 more change"). "Add or remove" is pinned at the foot.
 *
 * - Each block names the version, "· yours" on your own, with its full name grey at the right (CP-01).
 * - The reader's own version is "yours" and the base, a licensed one included (CP-07). If it can't load,
 *   the BSB stands in and says so; the choice is kept.
 * - Up to three others, chosen inside Compare (CP-06), shown in the order chosen.
 * - The Message is shown whole and unmarked, with one line saying why (CP-09).
 * - A version without the verse says so, with why where the manuscripts are the reason; nothing becomes the
 *   base in its place, and the others are shown unmarked (CP-08).
 * - When every version words it the same, it says so once over the verse (CP-03); punctuation never counts.
 *
 * Licensed text is display-only: compared here on the phone and nowhere else (CLAUDE.md rule 9).
 */

import { formatVerseId, ordToParts } from "@yada/schema";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { QuotedVerse, useOmittedVerse } from "../../components/OmittedVerse";
import { Row, SheetScreen } from "../../components/Sheet";
import { Chrome, Label, Prose, Scripture } from "../../components/Type";
import { DivineText } from "../../components/Verse";
import { useAppData, useCore, useQuery } from "../../data/AppData";
import { isLicensedCode } from "../../data/licensed";
import { BUILT_IN, getTextsInRange, readableTranslations } from "../../data/queries";
import { useTranslations } from "../../data/translations";
import { licensedCodes, licensedEnabled, loadLicensedVerses, versionName } from "../../data/useLicensedChapter";
import { useLayout, usePalette } from "../../design/tokens";
import { FONTS } from "../../design/type";
import { formatRange, resolveRef } from "../../lib/chapters";
import { compareSelection, comparingLabel, listAnd } from "../../lib/compare";
import { agreeLine, changeText, compareVerse, hasRealDivergence, type MarkedPiece } from "../../lib/diff";
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
  const omitted = useOmittedVerse(span?.startOrd ?? null);

  const label = span === null ? "" : formatRange(params.ref ?? "");
  // Opened from the reader's bar, Compare is the sheet's first page and no Understand is underneath (IA stress test).
  const openedFirst = (navigation.getState()?.index ?? 0) === 0;
  const firstId = span === null ? "" : formatVerseId(ordToParts(span.startOrd));
  const shell = (children: React.ReactNode) => (
    <SheetScreen
      title="Compare"
      subtitle={label}
      backLabel={label}
      verseId={firstId}
      closeLabel={openedFirst ? "Close, back to reading" : "Back to Understand"}
      foot={<AddOrRemove label={`Add or remove translations to compare. ${comparingLabel(others)}`} onPress={() => router.push({ pathname: "/evidence/choose", params: { ref: params.ref ?? "" } })} />}
      testID="translations"
    >
      {children}
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
    // CP-03: said once, the versions named under it, the verse once as a quote.
    return shell(
      <View testID="translations-agree">
        <Prose step="claim">{agreeLine(present.length)}</Prose>
        <Chrome step="note" tone="muted" style={{ marginTop: 2 }}>
          {listAnd(present)}
        </Chrome>
        <QuotedVerse text={all[0] ?? ""} translation={base} />
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
          <View key={v.ord} style={{ marginTop: vi === 0 ? 0 : 18 }}>
            {/* CP-05: a small caption over each verse's blocks (`.lbl.cmpv`), not a section title. */}
            {multi ? <Label style={{ marginBottom: 2 }}>{`${parts.chapter}:${parts.verse}`}</Label> : null}
            {compared.map((code, i) => {
              const text = textOf(code, v.ord, v.texts);
              // A licensed version that didn't load is not "not in" anything (review, 12 Oct 2026).
              const down = isLicensedCode(code) && data.licensed.get(code)?.available !== true;
              const missing = text === "" && readable.includes(code) && !down;
              const paraphrase = PARAPHRASES.has(code);
              // Marked only against a base that has the verse; never a paraphrase (CP-08, CP-09).
              const comparison = i === 0 || text === "" || yours === "" || paraphrase ? null : compareVerse(yours, text);
              const line = comparison === null ? "" : changeText(comparison.line);
              return (
                <VersionBlock key={code} code={code} name={versionName(code, installed)} yours={i === 0} testID={`compare-${code}`}>
                  {down ? (
                    <Prose step="claim" tone="muted">
                      {`The ${code} needs a connection.`}
                    </Prose>
                  ) : missing ? (
                    <>
                      <Chrome step="note" tone="muted">
                        {notInLine(code)}
                      </Chrome>
                      {/* CP-08: why, where the manuscripts are the reason (PD-06's note, pushed in this sheet). */}
                      {i === 0 && omitted !== null && !multi ? (
                        <Row first onPress={() => router.push({ pathname: "/evidence/missing", params: { ref: params.ref ?? "" } })} testID="compare-why-missing">
                          <Chrome tone="ink" style={{ fontWeight: "500" }}>
                            Why: not in the oldest manuscripts
                          </Chrome>
                        </Row>
                      ) : null}
                    </>
                  ) : (
                    <Scripture
                      step={i === 0 ? "explanation" : "claim"}
                      accessibilityLabel={spokenText(text, code)}
                      style={i === 0 ? null : { fontFamily: FONTS.scripture }}
                    >
                      {comparison === null ? <DivineText text={text} translation={code} /> : <MarkedText pieces={comparison.pieces} translation={code} />}
                    </Scripture>
                  )}
                  {line !== "" ? (
                    <Chrome step="note" tone="muted" style={{ marginTop: 6 }}>
                      {line}
                    </Chrome>
                  ) : null}
                  {paraphrase && i > 0 && text !== "" ? (
                    <Chrome step="note" tone="muted" style={{ marginTop: 6 }}>
                      A paraphrase, so it isn’t marked word by word.
                    </Chrome>
                  ) : null}
                </VersionBlock>
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

/**
 * One version (CP-01 `.cmpb`/`.cmpo`): its code, "· yours" on your own, and the full name grey at the right,
 * then its words; a hairline under each block.
 */
function VersionBlock({ code, name, yours, testID, children }: { code: string; name: string; yours: boolean; testID: string; children: React.ReactNode }) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.divider }} testID={testID}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={yours ? `${name}, your translation` : name}
        style={{ flexDirection: ax ? "column" : "row", justifyContent: "space-between", alignItems: ax ? "flex-start" : "baseline", columnGap: 12, rowGap: 2, marginBottom: 4 }}
      >
        <Chrome step="note" tone="ink" style={{ fontWeight: "600" }}>
          {code === "MSG" ? "The Message" : code}
          {yours ? <Text style={{ color: palette.mutedInk }}> · yours</Text> : null}
        </Chrome>
        {code === "MSG" ? null : (
          <Chrome step="note" tone="muted" style={{ textAlign: ax ? "left" : "right", flexShrink: 1 }}>
            {name}
          </Chrome>
        )}
      </View>
      {children}
    </View>
  );
}

/**
 * The words this version says in place of yours (CP-01 `mark.df`): the chartreuse highlighter with a muted
 * underline, so the difference is never colour alone (brief §3); never the selection's wash.
 */
function MarkedText({ pieces, translation }: { pieces: readonly MarkedPiece[]; translation: string }) {
  const palette = usePalette();
  return (
    <>
      {pieces.map((p, i) =>
        p.marked ? (
          <Text key={i} style={{ backgroundColor: palette.highlight, textDecorationLine: "underline", textDecorationColor: palette.mutedInk }}>
            <DivineText text={p.text} translation={translation} />
          </Text>
        ) : (
          <DivineText key={i} text={p.text} translation={translation} />
        ),
      )}
    </>
  );
}

/** "Add or remove", pinned at the sheet's foot (CP-01 `.cmpfoot .tbtn2`): a grey-fill capsule, + and the words. */
function AddOrRemove({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <View style={{ alignItems: "center" }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="compare-choose"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          columnGap: 6,
          minHeight: ax ? 64 : 48,
          paddingHorizontal: 22,
          borderRadius: 999,
          backgroundColor: palette.fill,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon name="plus" size={18} />
        <Chrome tone="ink" size={15} style={{ fontWeight: "600" }} numberOfLines={1}>
          Add or remove
        </Chrome>
      </Pressable>
    </View>
  );
}

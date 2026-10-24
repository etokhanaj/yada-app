/**
 * About a book (SC-05, OR-01 to OR-05, OR-09): the introduction's paragraph in a sheet over the reading; then, for a
 * book whose orientation John approved, its shape (sections in order), where (its places on the phone's own map) and
 * who (its Tyndale profiles). A section with nothing in the data does not appear (OR-05). Then BibleProject's overview
 * (OR-03), now that BibleProject has agreed to the link and its credit (OR-09, 19 Oct 2026); it is their page, not
 * Yada's, so it does not wait on the orientation review. Reached from the handle (SC-01) and Contents (SC-09).
 */

import { BOOK_CODES, isBookCode } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useBookIntro } from "../../components/AboutHandle";
import { OverviewCard } from "../../components/OverviewCard";
import { ListRow } from "../../components/Page";
import { PlaceMap } from "../../components/PlaceMap";
import { SheetScreen } from "../../components/Sheet";
import { SourceLine } from "../../components/SourceLine";
import { Chrome, Prose, SectionTitle } from "../../components/Type";
import { useQuery } from "../../data/AppData";
import { loadBookProfiles } from "../../data/study";
import { loadPassages } from "../../data/understand";
import { loadBookPlaces } from "../../data/wordsAndPlaces";
import { useLayout, usePalette } from "../../design/tokens";
import { BIBLEPROJECT_CREDIT, overviewsFor } from "../../lib/overviews";
import { INTRO_CREDIT, ORIENTATION_APPROVED, PEOPLE_CREDIT, PLACES_CREDIT, SHAPE_FIRST, shortRange } from "../../lib/orientation";

export default function About() {
  const { book } = useLocalSearchParams<{ book?: string }>();
  const code = book !== undefined && isBookCode(book) ? book : "JHN";
  const name = BOOK_CODES[code].name;
  const intro = useBookIntro(code);
  const overviews = overviewsFor(code);
  const palette = usePalette();
  const { sectionGap, ax } = useLayout();
  const shown = ORIENTATION_APPROVED.has(code) || __DEV__;
  const { data } = useQuery(
    async () => (shown ? { passages: await loadPassages(code), places: await loadBookPlaces(code), people: await loadBookProfiles(code) } : null),
    [code, shown],
  );
  const draft = shown && !ORIENTATION_APPROVED.has(code);

  return (
    <SheetScreen title={`About ${name}`} backLabel={null} noBack testID="about-book">
      {intro === null ? null : <Prose step="claim">{intro.text}</Prose>}
      {draft && data !== null && data !== undefined ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 10 }}>
          Draft · not yet reviewed
        </Chrome>
      ) : null}

      {data != null && data.passages.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>The shape</SectionTitle>
          {data.passages.slice(0, SHAPE_FIRST).map((p, i) => (
            <View key={p.id} style={[styles.shape, ax ? { flexDirection: "column", alignItems: "flex-start" } : null, i === 0 ? null : { borderTopColor: palette.divider, borderTopWidth: StyleSheet.hairlineWidth }]} accessible accessibilityLabel={`${p.label}, ${shortRange(p.startOrd, p.endOrd)}`}>
              <Chrome step="note" tone="muted" style={[styles.range, ax ? null : { width: 84 }]}>
                {shortRange(p.startOrd, p.endOrd)}
              </Chrome>
              <Prose step="claim" style={{ flex: ax ? undefined : 1 }}>
                {p.label}
              </Prose>
            </View>
          ))}
          {data.passages.length > SHAPE_FIRST ? (
            <ListRow title={`All ${data.passages.length} sections`} onPress={() => router.push({ pathname: "/about/sections", params: { book: code } })} label={`All ${data.passages.length} sections of ${name}, in order`} testID="about-sections" />
          ) : null}
        </View>
      ) : null}

      {data != null && data.places.length > 0 && data.places[0] !== undefined ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 10 }}>Where</SectionTitle>
          <PlaceMap place={data.places[0]} others={data.places.slice(1)} />
          <SourceLine>{PLACES_CREDIT}</SourceLine>
          <ListRow title={`All ${data.places.length} places`} onPress={() => router.push({ pathname: "/about/places", params: { book: code } })} label={`All ${data.places.length} places in ${name}`} testID="about-places" />
        </View>
      ) : null}

      {data != null && data.people.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>Who</SectionTitle>
          <View style={[styles.people, ax ? { flexDirection: "column", alignItems: "stretch" } : null]}>
            {data.people.map((p, i) => (
              <View key={p.id} style={styles.personWrap}>
                {i > 0 && !ax ? <Chrome tone="muted">{" · "}</Chrome> : null}
                <Pressable onPress={() => router.push({ pathname: "/about/person", params: { book: code, id: String(p.id), from: "" } })} accessibilityRole="button" accessibilityLabel={`${p.title}. Opens the profile`} style={styles.person} testID={`about-person-${p.id}`}>
                  <Chrome tone="accent" style={{ fontWeight: "600" }}>
                    {p.title}
                  </Chrome>
                </Pressable>
              </View>
            ))}
          </View>
          <SourceLine style={{ marginTop: 8 }}>{PEOPLE_CREDIT}</SourceLine>
        </View>
      ) : null}

      {overviews.length > 0 ? (
        <View style={{ marginTop: sectionGap, rowGap: 8 }}>
          {overviews.map((o, i) => (
            <OverviewCard key={o.url} overview={o} part={overviews.length > 1 ? `part ${i + 1}` : null} book={name} />
          ))}
          <Chrome step="note" tone="muted">
            {BIBLEPROJECT_CREDIT}
          </Chrome>
        </View>
      ) : null}

      {intro === null ? null : (
        <SourceLine style={{ marginTop: data != null || overviews.length > 0 ? sectionGap : 10 }}>{INTRO_CREDIT}</SourceLine>
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  shape: { flexDirection: "row", alignItems: "baseline", columnGap: 12, paddingVertical: 10 },
  range: { fontVariant: ["tabular-nums"] },
  people: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  personWrap: { flexDirection: "row", alignItems: "center" },
  person: { minHeight: 44, justifyContent: "center" },
});

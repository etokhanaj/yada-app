/**
 * A place (PM-30; MS-01, canvas WM-06), pushed inside the sheet it was opened from (Understand or a passage's guide),
 * never as a third sheet. Its name in Literata; the one thing the data says about where it is ("Identified with
 * Horbat Qana"); the map; Open in Maps; the book's verses that name it; the credit.
 * Pattern: Insight Timer's place, a heading, a framed map and Open in Maps,
 * https://mobbin.com/screens/5eeebd47-9082-479f-92a3-8997ff4799f1.
 *
 * The map is drawn on the phone, so it is there offline; only Open in Maps needs a connection, and says so to VoiceOver.
 */

import { BOOK_CODES, type BookCode, formatDisplayRef, formatVerseId, ordToParts } from "@yada/schema";
import { router } from "expo-router";
import { Linking, View } from "react-native";

import { useCore, useQuery } from "../data/AppData";
import { getTextsForOrds, readableTranslations } from "../data/queries";
import { loadPassageFor } from "../data/understand";
import { loadPlace, loadPlacesInRange } from "../data/wordsAndPlaces";
import { FONTS } from "../design/tokens";
import { appleMapsUrl, placeLine } from "../lib/wordsAndPlaces";
import { useSettings } from "../state/settings";
import { useSheetBase } from "./navigation";
import { Pill } from "./Pill";
import { PlaceMap } from "./PlaceMap";
import { Row, Section, SheetScreen, UNDERSTAND_EXIT } from "./Sheet";
import { SourceLine } from "./SourceLine";
import { Chrome, Prose, Scripture } from "./Type";

export function PlaceScreen({ book, id, from }: { book: BookCode; id: string; from: number }) {
  const core = useCore();
  const base = useSheetBase();
  const translation = useSettings((s) => s.translation);
  // The reader's own version where the phone has it; a licensed one is shown through the BSB, as Verse by verse (rule 9).
  const code = readableTranslations().includes(translation) ? translation : "BSB";
  const { data } = useQuery(async () => {
    const found = await loadPlace(book, id);
    if (found === null) return null;
    // The other places of the passage it was opened from, for orientation on the map.
    const passage = Number.isFinite(from) ? await loadPassageFor(book, from) : null;
    const others = passage === null ? [] : (await loadPlacesInRange(book, passage.startOrd, passage.endOrd)).filter((p) => p.id !== id && !(p.lon === found.place.lon && p.lat === found.place.lat));
    const texts = await getTextsForOrds(core, found.ords, code);
    return { ...found, others, texts };
  }, [book, id, from, code]);
  const title = data?.place.name ?? "";
  const fromDisplay = Number.isFinite(from) ? formatDisplayRef(ordToParts(from)) : null;
  if (data === undefined || data === null) return <SheetScreen title={title} backLabel={fromDisplay} titleInBody {...UNDERSTAND_EXIT}>{null}</SheetScreen>;
  const { place, ords, others, texts } = data;
  const line = placeLine(place);
  const bookName = BOOK_CODES[book].name;
  return (
    <SheetScreen title={place.name} backLabel={fromDisplay} titleInBody testID="place" {...UNDERSTAND_EXIT}>
      <Prose step="display" accessibilityRole="header" style={{ fontWeight: "400" }} testID="place-name">
        {place.name}
      </Prose>
      {line !== "" ? (
        <Chrome tone="muted" style={{ marginTop: 2 }} testID="place-line">
          {line}
        </Chrome>
      ) : null}
      <View style={{ marginTop: 14 }}>
        <PlaceMap place={place} others={others} />
      </View>
      <View style={{ alignItems: "flex-start" }}>
        <Pill small icon="pin" title="Open in Maps" label="Open in Maps, needs a connection" onPress={() => void Linking.openURL(appleMapsUrl(place))} testID="place-open-maps" />
      </View>
      {/* The count is the data's own: the verses of this book whose places name it (rule 4). */}
      <Section title={`In ${bookName}`} hint={`${ords.length} ${ords.length === 1 ? "verse" : "verses"}`}>
        {ords.map((o, i) => {
          const parts = ordToParts(o);
          const ref = `${bookName} ${parts.chapter}:${parts.verse}`;
          const text = texts.get(o) ?? "";
          return (
            <Row key={o} first={i === 0} onPress={() => router.push({ pathname: `${base}/verse`, params: { ref: formatVerseId(parts) } })} label={`${ref}, ${text}`} testID={`place-verse-${parts.chapter}:${parts.verse}`}>
              <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
                {ref}
              </Chrome>
              {text !== "" ? (
                <Scripture step="claim" numberOfLines={2} style={{ fontFamily: FONTS.scripture }}>
                  {text}
                </Scripture>
              ) : null}
            </Row>
          );
        })}
      </Section>
      {/* CC BY 4.0 asks for the credit where the data is shown (OpenBible's readme), here by name and a link to
          Sources (§3(a)(2)); Natural Earth asks for none. */}
      <SourceLine style={{ marginTop: 16 }} testID="place-credit">OpenBible.info · Natural Earth</SourceLine>
    </SheetScreen>
  );
}

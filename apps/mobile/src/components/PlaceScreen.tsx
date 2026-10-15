/**
 * MS-01's place (canvas WM-06), pushed inside the sheet it was opened from (Understand or a passage's
 * guide), never as a third sheet. The map first; then the one thing the data says about where it is
 * ("Identified with Al Eizariya"); then the book's verses that name it; then the credit.
 * Pattern: Insight Timer's place, a heading, a framed map and Open in Maps,
 * https://mobbin.com/screens/5eeebd47-9082-479f-92a3-8997ff4799f1.
 *
 * The map is drawn on the phone, so it is there offline; only Open in Maps needs a connection, and says so.
 */

import { BOOK_CODES, type BookCode, formatDisplayRef, formatVerseId, ordToParts } from "@yada/schema";
import { router } from "expo-router";
import { Linking, View } from "react-native";

import { useCore, useQuery } from "../data/AppData";
import { getTextsForOrds } from "../data/queries";
import { loadPassageFor } from "../data/understand";
import { loadPlace, loadPlacesInRange } from "../data/wordsAndPlaces";
import { appleMapsUrl, placeLine } from "../lib/wordsAndPlaces";
import { useSheetBase } from "./navigation";
import { PlaceMap } from "./PlaceMap";
import { Row, RowNote, Section, SheetScreen, UNDERSTAND_EXIT } from "./Sheet";
import { Chrome, Prose } from "./Type";

export function PlaceScreen({ book, id, from }: { book: BookCode; id: string; from: number }) {
  const core = useCore();
  const base = useSheetBase();
  const { data } = useQuery(async () => {
    const found = await loadPlace(book, id);
    if (found === null) return null;
    // The other places of the passage it was opened from, for orientation on the map.
    const passage = Number.isFinite(from) ? await loadPassageFor(book, from) : null;
    const others = passage === null ? [] : (await loadPlacesInRange(book, passage.startOrd, passage.endOrd)).filter((p) => p.id !== id && !(p.lon === found.place.lon && p.lat === found.place.lat));
    const texts = await getTextsForOrds(core, found.ords, "BSB");
    return { ...found, others, texts };
  }, [book, id, from]);
  const fromDisplay = Number.isFinite(from) ? formatDisplayRef(ordToParts(from)) : undefined;
  const title = data?.place.name ?? "";
  if (data === undefined || data === null) return <SheetScreen title={title} subtitle={fromDisplay} backLabel={fromDisplay ?? null} {...UNDERSTAND_EXIT}>{null}</SheetScreen>;
  const { place, ords, others, texts } = data;
  const line = placeLine(place);
  return (
    <SheetScreen title={place.name} subtitle={fromDisplay} backLabel={fromDisplay ?? null} testID="place" {...UNDERSTAND_EXIT}>
      <PlaceMap place={place} others={others} />
      {line !== "" ? (
        <Prose step="claim" testID="place-line">
          {line}
        </Prose>
      ) : null}
      <Section title={`In ${BOOK_CODES[book].name}`}>
        {ords.map((o, i) => {
          const parts = ordToParts(o);
          const ref = `${parts.chapter}:${parts.verse}`;
          const text = texts.get(o) ?? "";
          return (
            <Row key={o} first={i === 0} onPress={() => router.push({ pathname: `${base}/verse`, params: { ref: formatVerseId(parts) } })} label={`${BOOK_CODES[book].name} ${ref}, ${text}`} testID={`place-verse-${ref}`}>
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                {`${BOOK_CODES[book].name} ${ref}`}
              </Chrome>
              {text !== "" ? <RowNote>{text}</RowNote> : null}
            </Row>
          );
        })}
      </Section>
      <View style={{ marginTop: 20 }}>
        <Row first onPress={() => void Linking.openURL(appleMapsUrl(place))} label="Open in Maps, needs a connection" testID="place-open-maps">
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Open in Maps
          </Chrome>
          <RowNote>Needs a connection</RowNote>
        </Row>
      </View>
      {/* CC BY 4.0 asks for the credit where the data is shown (OpenBible's readme); Natural Earth asks for none. */}
      <Chrome step="note" tone="muted" style={{ marginTop: 16 }} testID="place-credit">
        Place: OpenBible.info, CC BY 4.0 · Map: Natural Earth
      </Chrome>
    </SheetScreen>
  );
}

/**
 * MS-01 in a passage's guide (canvas WM-05): the places OpenBible.info identifies with confidence, in
 * the order the passage first names them, each a row to its map. Nothing when the passage has none, or
 * the book's file predates build 6.
 */

import type { BookCode } from "@yada/schema";
import { router } from "expo-router";

import { useQuery } from "../data/AppData";
import { loadPlacesInRange } from "../data/wordsAndPlaces";
import { placeLine } from "../lib/wordsAndPlaces";
import { useSheetBase } from "./navigation";
import { Row, RowNote, Section } from "./Sheet";
import { Chrome } from "./Type";

export function PlacesInPassage({ book, startOrd, endOrd }: { book: BookCode; startOrd: number; endOrd: number }) {
  const base = useSheetBase();
  const { data } = useQuery(() => loadPlacesInRange(book, startOrd, endOrd), [book, startOrd, endOrd]);
  if (data === undefined || data.length === 0) return null;
  return (
    <Section title="Places in this passage">
      {data.map((p, i) => {
        const line = placeLine(p);
        return (
          <Row
            key={p.id}
            first={i === 0}
            onPress={() => router.push({ pathname: `${base}/place`, params: { book, id: p.id, from: String(startOrd) } })}
            label={`${p.name}${line === "" ? "" : `, ${line}`}. Opens its map`}
            testID={`guide-place-${p.name}`}
          >
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {p.name}
            </Chrome>
            {line !== "" ? <RowNote>{line}</RowNote> : null}
          </Row>
        );
      })}
    </Section>
  );
}

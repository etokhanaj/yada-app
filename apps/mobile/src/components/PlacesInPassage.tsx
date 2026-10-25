/**
 * Places in a passage's guide (UN-30; MS-01, canvas WM-05): the places OpenBible.info identifies with confidence, in
 * the order the passage first names them, each a card that opens its map: one self-contained thing you tap, on `fill`
 * as cards inside a sheet are (design-system.md). Two to a row; one at AX sizes. Nothing when the passage has none,
 * or the book's file predates build 6.
 */

import type { BookCode } from "@yada/schema";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useQuery } from "../data/AppData";
import { loadPlacesInRange } from "../data/wordsAndPlaces";
import { useLayout, usePalette } from "../design/tokens";
import { type PlaceRow, placeLine } from "../lib/wordsAndPlaces";
import { Icon } from "./Icon";
import { useSheetBase } from "./navigation";
import { Section } from "./Sheet";
import { Chrome } from "./Type";

/** The card's second line: the modern site alone (UN-30 "Horbat Qana"); VoiceOver hears placeLine's "Identified with". */
function cardLine(p: PlaceRow): string {
  return p.modern !== "" && p.modern !== p.name ? p.modern : placeLine(p);
}

export function PlacesInPassage({ book, startOrd, endOrd }: { book: BookCode; startOrd: number; endOrd: number }) {
  const base = useSheetBase();
  const palette = usePalette();
  const { ax } = useLayout();
  const { data } = useQuery(() => loadPlacesInRange(book, startOrd, endOrd), [book, startOrd, endOrd]);
  if (data === undefined || data.length === 0) return null;
  return (
    <Section title="Places">
      <View style={styles.grid}>
        {data.map((p) => {
          const line = cardLine(p);
          const spoken = placeLine(p);
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: `${base}/place`, params: { book, id: p.id, from: String(startOrd) } })}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}${spoken === "" ? "" : `, ${spoken}`}. Opens its map`}
              style={({ pressed }) => [styles.card, ax ? styles.cardAx : null, { backgroundColor: palette.fill, opacity: pressed ? 0.8 : 1 }]}
              testID={`guide-place-${p.name}`}
            >
              <View style={styles.name}>
                <Icon name="pin" size={18} tone="accent" />
                <Chrome tone="ink" style={{ flexShrink: 1, fontWeight: "600" }}>
                  {p.name}
                </Chrome>
              </View>
              {line !== "" ? (
                <Chrome step="note" tone="muted" maxFontSizeMultiplier={2}>
                  {line}
                </Chrome>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginTop: 4 },
  card: { width: "48.5%", minHeight: 44, borderRadius: 24, padding: 14, rowGap: 4 },
  cardAx: { width: "100%" },
  name: { flexDirection: "row", alignItems: "center", columnGap: 6 },
});

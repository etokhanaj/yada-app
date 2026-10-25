/**
 * About this picture (DR-14): from the day's verse's ⋯, or a long press on Today's picture. Title, By, From, Chosen
 * for and Licence, each a small label over its value, exactly as the picture's manifest holds them
 * (content/pictures/manifest.json): nothing here is written up beyond what the source records. Where the manifest has
 * an account name rather than a person's ("YellowstoneNPS"), that is what shows (images audit, 18 Oct 2026).
 */

import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useLayout } from "../design/tokens";
import { SheetScreen } from "../components/Sheet";
import { Chrome } from "../components/Type";
import { pictureFor } from "../data/pictures";
import { verseFor } from "../lib/dailyLight";
import { dayLabel, dayOf, parseDayParam, type Part, partOf } from "../lib/today";
import { verseLabel } from "../lib/saved";

export default function AboutPicture() {
  const fitSheet = !useLayout().ax;
  const params = useLocalSearchParams<{ day?: string; part?: string }>();
  const day = parseDayParam(params.day) ?? dayOf(new Date());
  const part: Part = params.part === "evening" ? "evening" : params.part === "morning" ? "morning" : partOf(new Date());
  const picture = pictureFor(day, part);
  const chosen = verseFor(day, part);
  const rows: Array<[string, string]> =
    picture === undefined
      ? []
      : [
          ["Title", picture.title],
          ["By", picture.by],
          ["From", picture.from],
          // "Psalm 1:3", as Today and the day's verse name it; shortRef's "Psa 1:3" is for tight rows.
          ["Chosen for", verseLabel({ book: chosen.book, chapter: chosen.chapter, verse: chosen.verse })],
          ["Licence", picture.licence],
        ];
  return (
    <SheetScreen fit={fitSheet} title="About this picture" subtitle={dayLabel(day)} backLabel={null} footer={false} noBack testID="about-picture">
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
          <Chrome step="note" tone="muted">
            {label}
          </Chrome>
          <Chrome tone="ink">{value}</Chrome>
        </View>
      ))}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  row: { rowGap: 2, marginBottom: 16 },
});

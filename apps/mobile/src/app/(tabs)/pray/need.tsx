/**
 * One need (Build 12 BN-31): its prayers in Bible order, each with its passage and how many verses, opening the prayer
 * to pray it (PT-43). Reached from a tile on Bible prayers or a row on By need, so its back names where it came from.
 */

import { router, useLocalSearchParams } from "expo-router";

import { ListRow, PageScreen } from "../../../components/Page";
import { ALL_NEEDS, prayerLength, prayerRef, prayersFor } from "../../../data/prayersOfTheBible";

export default function Need() {
  const { need: given = "", from } = useLocalSearchParams<{ need?: string; from?: string }>();
  const need = ALL_NEEDS.find((n) => n === given);
  const prayers = need === undefined ? [] : prayersFor(need);
  return (
    <PageScreen title={need ?? "Bible prayers"} back={from === "needs" ? "By need" : "Bible prayers"} clearTabBar testID="pray-need">
      {prayers.map(({ prayer, index }, i) => (
        <ListRow
          key={index}
          first={i === 0}
          book
          title={prayer.title}
          subtitle={`${prayerRef(prayer)} · ${prayerLength(prayer)}`}
          label={`${prayer.title}, ${prayerRef(prayer)}, ${prayerLength(prayer)}`}
          onPress={() => router.push({ pathname: "/prayer", params: { i: String(index) } })}
          testID={`need-prayer-${index}`}
        />
      ))}
    </PageScreen>
  );
}

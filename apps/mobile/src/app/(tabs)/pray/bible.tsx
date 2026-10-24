/**
 * Bible prayers (PT-42, PT-45; approved by John 24 Oct 2026: "how can I find a prayer that fits what I am going
 * through"). The Lord's Prayer leads with Pray; six needs as tiles, all in view at once; then all 39 in Bible order. A
 * tile shows only that need's prayers (PT-45); tapped again, all of them. A row opens the prayer to pray it, not the
 * reader (PT-43). The list is data (data/prayersOfTheBible.ts): the 39 John approved on 18 Oct 2026.
 */

import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ListRow, PageScreen } from "../../../components/Page";
import { Chrome, SectionTitle } from "../../../components/Type";
import {
  PRAYER_NEEDS,
  type PrayerNeed,
  PRAYERS_OF_THE_BIBLE,
  prayerRef,
} from "../../../data/prayersOfTheBible";
import { FONTS, useLayout, usePalette } from "../../../design/tokens";

const open = (i: number) =>
  router.push({ pathname: "/prayer", params: { i: String(i) } });

export default function BiblePrayers() {
  const palette = usePalette();
  const { ax } = useLayout();
  const [need, setNeed] = useState<PrayerNeed | null>(null);
  const lord = PRAYERS_OF_THE_BIBLE.findIndex((p) => p.need === "Every day");
  const lordsPrayer = PRAYERS_OF_THE_BIBLE[lord];
  const shown = PRAYERS_OF_THE_BIBLE.map((p, i) => ({ p, i })).filter(
    ({ p }) => (need === null ? true : p.need === need),
  );
  return (
    <PageScreen
      title="Bible prayers"
      back="Pray"
      clearTabBar
      testID="pray-bible"
    >
      {lordsPrayer !== undefined ? (
        <View style={[styles.lead, { backgroundColor: palette.fill }]}>
          <View style={{ flex: 1 }}>
            <Chrome
              tone="ink"
              style={{ fontFamily: FONTS.scripture, fontWeight: "400" }}
              size={24}
            >
              {lordsPrayer.title}
            </Chrome>
            <Chrome step="note" tone="muted">
              {prayerRef(lordsPrayer)}
            </Chrome>
          </View>
          <Pressable
            onPress={() => open(lord)}
            accessibilityRole="button"
            accessibilityLabel={`Pray ${lordsPrayer.title}`}
            style={[styles.pray, { backgroundColor: palette.ink }]}
            testID="bible-lords-prayer"
          >
            <Chrome style={{ color: palette.paper, fontWeight: "600" }}>
              Pray
            </Chrome>
          </Pressable>
        </View>
      ) : null}

      <View
        style={[styles.needs, ax ? styles.needsAx : null]}
        accessibilityRole="radiogroup"
        accessibilityLabel="Prayers for"
      >
        {PRAYER_NEEDS.map((n) => {
          const on = need === n;
          return (
            <Pressable
              key={n}
              onPress={() => setNeed(on ? null : n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[
                styles.need,
                ax ? styles.needAx : null,
                { backgroundColor: on ? palette.ink : palette.fill },
              ]}
              testID={`bible-need-${n}`}
            >
              <Chrome
                style={{
                  fontFamily: FONTS.scripture,
                  fontWeight: "400",
                  textAlign: "center",
                  color: on ? palette.paper : palette.ink,
                }}
                size={17}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {n}
              </Chrome>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle style={{ marginTop: 26, marginBottom: 2 }}>
        {need === null ? `All ${PRAYERS_OF_THE_BIBLE.length}` : need}
      </SectionTitle>
      {shown.map(({ p, i }, n) => (
        <ListRow
          key={`${p.book}.${p.chapter}.${p.from}`}
          first={n === 0}
          book
          chevron={false}
          title={p.title}
          subtitle={prayerRef(p)}
          label={`${p.title}, ${prayerRef(p)}`}
          onPress={() => open(i)}
        />
      ))}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  lead: {
    borderRadius: 24,
    paddingVertical: 16,
    paddingLeft: 20,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  pray: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    justifyContent: "center",
  },
  needs: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginTop: 12,
  },
  needsAx: { rowGap: 8 },
  need: {
    width: "32%",
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  needAx: { width: "48.5%" },
});

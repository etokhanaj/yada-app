/**
 * Bible prayers (PT-42, PT-45; Build 12 BP-30, approved by John 24 Oct 2026: "how can I find a prayer that fits what I
 * am going through"). The Lord's Prayer on its own picture with Pray; By need as six tint tiles with See all (John,
 * 25 Oct 2026: "so we don't flood it, except it remains just 6"), each opening that need's prayers (BN-31); then all
 * of them in Bible order. A row opens the prayer to pray it, not the reader (PT-43). The list is data
 * (data/prayersOfTheBible.ts): the ones John approved (18 and 25 Oct 2026).
 */

import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { FillPicture } from "../../../components/FillPicture";
import { ListRow, PageScreen } from "../../../components/Page";
import { Pill } from "../../../components/Pill";
import { TileGrid, TintTile } from "../../../components/Tiles";
import { Chrome, SectionTitle } from "../../../components/Type";
import { pictureFor } from "../../../data/pictures";
import { PRAYER_NEEDS, PRAYERS_OF_THE_BIBLE, prayerRef } from "../../../data/prayersOfTheBible";
import { BRAND, ON_PICTURE, SCRIM, type Tint } from "../../../design/palette";
import { FONTS, useLayout } from "../../../design/tokens";

const open = (i: number) => router.push({ pathname: "/prayer", params: { i: String(i) } });
/** The Lord's Prayer keeps day 16's picture (Pictures, decision 5: a thing keeps its own picture). */
const LORDS_PICTURE = 16;
const NEED_TINTS: readonly Tint[] = ["forest", "sand", "sky", "clay", "sand", "forest"];

export default function BiblePrayers() {
  const { ax, sectionGap } = useLayout();
  // Pray, or Search when opened from its ways in (SE-30).
  const { back = "Pray" } = useLocalSearchParams<{ back?: string }>();
  const lord = PRAYERS_OF_THE_BIBLE.findIndex((p) => p.need === "Every day");
  const lordsPrayer = PRAYERS_OF_THE_BIBLE[lord];
  const picture = pictureFor(LORDS_PICTURE, "morning");
  return (
    <PageScreen title="Bible prayers" back={back} clearTabBar testID="pray-bible">
      {lordsPrayer === undefined ? null : (
        <View style={[styles.lead, { height: ax ? 190 : 150, backgroundColor: BRAND.forest }]}>
          {picture === undefined ? null : <FillPicture source={picture.image} />}
          <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: SCRIM.setup }]} />
          <View style={[styles.leadFoot, ax ? { flexDirection: "column", alignItems: "flex-start" } : null]}>
            <View style={{ flexShrink: 1 }}>
              <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" }} size={26} maxFontSizeMultiplier={1.4}>
                {lordsPrayer.title}
              </Chrome>
              <Chrome step="note" style={{ color: ON_PICTURE.strong }}>
                {prayerRef(lordsPrayer)}
              </Chrome>
            </View>
            <Pill small onPicture title="Pray" label={`Pray ${lordsPrayer.title}`} onPress={() => open(lord)} testID="bible-lords-prayer" />
          </View>
        </View>
      )}

      <SectionTitle style={{ marginTop: sectionGap }} link={{ label: "See all needs", title: "See all", onPress: () => router.push("/pray/needs"), testID: "bible-needs-all" }}>
        By need
      </SectionTitle>
      <TileGrid>
        {PRAYER_NEEDS.map((n, i) => (
          <TintTile key={n} tint={NEED_TINTS[i] ?? "sand"} title={n} onPress={() => router.push({ pathname: "/pray/need", params: { need: n } })} testID={`bible-need-${n}`} />
        ))}
      </TileGrid>

      <SectionTitle style={{ marginTop: sectionGap, marginBottom: 2 }}>{`All ${PRAYERS_OF_THE_BIBLE.length}`}</SectionTitle>
      {PRAYERS_OF_THE_BIBLE.map((p, i) => (
        <ListRow
          key={`${p.book}.${p.chapter}.${p.from}`}
          first={i === 0}
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
  lead: { borderRadius: 24, overflow: "hidden", justifyContent: "flex-end" },
  leadFoot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", columnGap: 10, rowGap: 8, padding: 18 },
});

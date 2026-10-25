/**
 * A mood's page (MO-30): the mood's own picture with its name on it, one passage at a time in large Literata, swiped
 * up for the next, the reference and where you are beneath; Sit with this and Open in Bible docked at the foot, the
 * helpline line above them. Opened from Pray's When you're (PT-46) and Search's For a moment (VM-01).
 *
 * The picture is the one the mood keeps on its tile (Build 12 decision 5: a mood keeps its picture), so the page a
 * tile opens is the tile's own. The words are always the BSB's, whatever the reader reads, and say so when the reader
 * reads a licensed version (rule 9, VM-10); Open in Bible opens their own version. No rank, score or count (John,
 * 18 Oct 2026).
 */

import { ordToParts } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, View, type ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FillPicture } from "../components/FillPicture";
import { GlassButton } from "../components/Glass";
import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { Pill } from "../components/Pill";
import { SourceLine } from "../components/SourceLine";
import { Chrome, Scripture } from "../components/Type";
import { DivineText } from "../components/Verse";
import { useCore, useQuery } from "../data/AppData";
import { isLicensedCode } from "../data/licensed";
import { pictureFor } from "../data/pictures";
import { getTextsInRange } from "../data/queries";
import { BRAND, ON_PICTURE, SCRIM } from "../design/palette";
import { FONTS, useLayout, usePalette, useType } from "../design/tokens";
import { lastLine, type MomentPassage, momentNamed, opening, passageLabel } from "../lib/moments";
import { helplineFor, phoneRegion } from "../lib/pray";
import { sittable } from "../lib/sit";
import { psalmTitleLine } from "../lib/systemSurfaces";
import { useSettings } from "../state/settings";

/** A passage shows its first words and opens whole in the reader (VM-04); fewer at accessibility sizes, as MO-30's AX5. */
const WORDS = 46;
const WORDS_AX = 12;

export default function MomentPage() {
  // `reopen`: opened from the Search sheet, which closed for the page; Back opens it again on the moments (VM-09).
  const params = useLocalSearchParams<{ name?: string; reopen?: string; from?: string }>();
  // Opened from Pray's When you're (PT-46), Back names Pray.
  const backTo = params.from === "pray" ? "Pray" : "Search";
  const moment = momentNamed(params.name ?? "");
  const core = useCore();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { gutter, ax } = useLayout();
  // MO-30: 30 pt at the default size, following the reader's own Dynamic Type, held at 38 (AX5) so a passage fits
  // its page under the picture.
  const verseSize = Math.min(38, Math.round((useType("scripture").size * 30) / 21));
  const translation = useSettings((s) => s.translation);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState(0);
  const { data: texts } = useQuery(
    async () =>
      Promise.all(
        (moment?.passages ?? []).map(async (q) => {
          const rows = await getTextsInRange(core, q.start, q.end);
          return rows
            .map((r) => {
              const t = r.texts.BSB ?? "";
              const at = ordToParts(r.ord);
              // A psalm's printed title is the BSB's own, but it is not what the moment is for: the psalm's words lead.
              return at.verse === 1 ? psalmTitleLine(at.book, at.verse, t).body : t;
            })
            .join(" ");
        }),
      ),
    [moment?.name],
  );
  if (moment === undefined) return null;
  const passage = moment.passages[index];
  const helpline = helplineFor(phoneRegion());
  const licensed = isLicensedCode(translation);

  const open = (q: MomentPassage) => {
    const a = ordToParts(q.start);
    const b = ordToParts(q.end);
    router.push(readerHref({ book: a.book, chapter: a.chapter, verse: a.verse, select: true, ...(b.chapter === a.chapter ? { to: b.verse } : {}), back: moment.name }));
  };
  const sit = (q: MomentPassage, text: string) => {
    const a = ordToParts(q.start);
    router.push({ pathname: "/sit", params: { text, ref: passageLabel(q), bsb: licensed ? "1" : "", place: `${a.book}.${a.chapter}.${a.verse}`, why: moment.name } });
  };
  const onViewable = ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  };

  const picture = pictureFor(moment.picture, "morning");
  const back = () => {
    router.back();
    if (params.reopen === "1") router.push("/search");
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }} testID="moment">
      <StatusBar style="light" />
      {/* MO-30's top: the mood's picture under its scrim, ‹ Pray and the mood's name on it in Literata. */}
      <View style={[styles.band, { paddingTop: insets.top + 4, paddingHorizontal: gutter, backgroundColor: BRAND.night }]}>
        {/* A full-size layer: on the padded band itself the picture's 100% stopped at the padding (12f QA). */}
        {picture !== undefined ? (
          <View style={StyleSheet.absoluteFill}>
            <FillPicture source={picture.image} />
          </View>
        ) : null}
        <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: SCRIM.setup }]} />
        <View style={styles.top}>
          <GlassButton shape="capsule" onPicture onPress={back} accessibilityLabel={`Back to ${backTo}`} testID="moment-back">
            <Icon name="back" size={18} tone="white" />
            <Chrome style={{ color: ON_PICTURE.text, fontWeight: "500", marginRight: 2 }}>{backTo}</Chrome>
          </GlassButton>
        </View>
        <Chrome
          accessibilityRole="header"
          size={ax ? 40 : 34}
          style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", marginTop: ax ? 14 : 22 }}
        >
          {moment.name}
        </Chrome>
      </View>

      {/* Clipped, so a passage swiped up leaves under the picture's edge. */}
      <View style={{ flex: 1, overflow: "hidden" }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 ? (
          <FlatList
            data={moment.passages}
            keyExtractor={(q) => `${q.start}-${q.end}`}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            renderItem={({ item, index: i }) => (
              <ScrollView
                style={{ height }}
                contentContainerStyle={{ minHeight: height, paddingTop: ax ? 28 : 32, paddingBottom: 16, paddingHorizontal: gutter }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                <View
                  accessible
                  accessibilityLabel={`${passageLabel(item)}. ${texts?.[i] ?? ""}`}
                  accessibilityHint={i < moment.passages.length - 1 ? `Passage ${i + 1} of ${moment.passages.length}. Swipe up for the next` : `Passage ${i + 1} of ${moment.passages.length}, the last`}
                >
                  <Scripture style={{ fontSize: verseSize, lineHeight: Math.round(verseSize * 1.35), letterSpacing: -0.4 }} maxFontSizeMultiplier={1}>
                    {texts?.[i] === undefined ? "" : <DivineText text={opening(texts[i] ?? "", ax ? WORDS_AX : WORDS)} translation="BSB" />}
                  </Scripture>
                  <Chrome step="note" tone="muted" style={{ marginTop: 12, fontWeight: "600" }}>
                    {passageLabel(item)}
                  </Chrome>
                </View>
                {/* MO-30: where you are among the passages, under the one you're on. */}
                <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {moment.passages.map((q, n) => (
                    <View key={`${q.start}-${q.end}`} style={[styles.dot, { backgroundColor: n === i ? palette.ink : palette.divider }]} />
                  ))}
                </View>
                {i === moment.passages.length - 1 ? (
                  <Chrome step="note" tone="muted" style={{ marginTop: 14 }} testID="moment-last">
                    {lastLine(moment)}
                  </Chrome>
                ) : null}
                {/* OpenBible.info's CC BY 4.0 credit for the references, and the BSB named when the reader reads a licensed version (VM-10). */}
                <SourceLine style={{ marginTop: 4 }}>{licensed ? "BSB · OpenBible.info" : "OpenBible.info"}</SourceLine>
              </ScrollView>
            )}
          />
        ) : null}
      </View>

      <View style={{ paddingHorizontal: gutter, paddingTop: 8, paddingBottom: insets.bottom + 12, rowGap: 8, backgroundColor: palette.paper }}>
        {/* VM-02, VM-08: only a line Yada has checked is named; anywhere else, Find A Helpline. */}
        {moment.support ? (
          <Pressable
            onPress={() => void Linking.openURL(helpline.call !== null ? `tel:${helpline.call.replace(/\s/g, "")}` : helpline.url)}
            accessibilityRole="link"
            accessibilityLabel={helpline.call !== null ? `Struggling? Call ${helpline.name}, free, any time, on ${helpline.call}` : "Struggling? Find a helpline where you are. Opens Find A Helpline"}
            hitSlop={8}
            style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}
            testID="moment-helpline"
          >
            <Chrome step="note" tone="muted" style={{ textAlign: "center" }}>
              {helpline.call !== null ? `Struggling? ${helpline.name}, free, any time · ${helpline.call}` : "Struggling? Find a helpline where you are"}
            </Chrome>
          </Pressable>
        ) : null}
        {passage !== undefined ? (
          // Sit with this beside Open in Bible: the verse a reader is holding is the one they sit with (Sit audit, 24 Oct
          // 2026). Only a short passage: Sit reads it aloud twice.
          <View style={ax ? { rowGap: 8 } : { flexDirection: "row", columnGap: 8 }}>
            {sittable(texts?.[index] ?? "") ? (
              <Pill grow icon="sit" title="Sit with this" label={`Sit with ${passageLabel(passage)}`} onPress={() => sit(passage, texts?.[index] ?? "")} testID="moment-sit" />
            ) : null}
            <Pill primary grow title="Open in Bible" label={`Open ${passageLabel(passage)} in the Bible`} onPress={() => open(passage)} testID="moment-open" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { overflow: "hidden", paddingBottom: 20 },
  top: { flexDirection: "row", alignItems: "center", minHeight: 48 },
  dots: { flexDirection: "row", columnGap: 7, marginTop: 18 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});

/**
 * Verses for a moment (VM-02 to VM-04, VM-08 to VM-11): one passage at a time, swiped up for the next, the reference
 * beneath, one button to open it in the Bible. Mobbin, iOS, 18 Oct 2026: Once (mobbin.com/screens/23735035-a15a-4474-
 * a907-bcce8e152d34: serif text, three dots, nothing else), Wispr Flow (e9aa8816-808d-44be-afee-c432d7ab9b91) and Noom
 * (4fef755a-a2fe-4172-b699-6583e94bf1af): large serif, one pill. Opened from Search's "For a moment" (VM-01).
 *
 * The words are always the BSB's, whatever the reader reads, and say so when the reader reads a licensed version (rule
 * 9, VM-10); Open in Bible opens their own version. No rank, score or count (John, 18 Oct 2026).
 */

import { ordToParts } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, View, type ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "../components/Glass";
import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { Pill } from "../components/Pill";
import { SourceLine } from "../components/SourceLine";
import { Chrome, Scripture } from "../components/Type";
import { DivineText } from "../components/Verse";
import { useCore, useQuery } from "../data/AppData";
import { isLicensedCode } from "../data/licensed";
import { getTextsInRange } from "../data/queries";
import { useLayout, usePalette, useType } from "../design/tokens";
import { lastLine, type MomentPassage, momentNamed, opening, passageLabel } from "../lib/moments";
import { helplineFor, phoneRegion } from "../lib/pray";
import { psalmTitleLine } from "../lib/systemSurfaces";
import { useSettings } from "../state/settings";

/** A passage shows its first words and opens whole in the reader (VM-04); fewer at accessibility sizes, as VM-02's AX5. */
const WORDS = 46;
const WORDS_AX = 24;

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
  // VM-02's .vmv2: 30 pt at the default size, following the reader's own Dynamic Type, held at 48 (AX5).
  const verseSize = Math.min(48, Math.round((useType("scripture").size * 30) / 21));
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
  const onViewable = ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 12 }} testID="moment">
      {/* VM-02's top: ‹ Search, then the moment's name beside it, muted. */}
      <View style={[styles.top, { paddingHorizontal: 12 }]}>
        <GlassButton
          shape="capsule"
          onPress={() => {
            router.back();
            if (params.reopen === "1") router.push("/search");
          }}
          accessibilityLabel={`Back to ${backTo}`}
          testID="moment-back"
        >
          <Icon name="back" size={18} tone="muted" />
          <Chrome tone="ink" style={{ fontWeight: "500", marginRight: 2 }}>
            {backTo}
          </Chrome>
        </GlassButton>
        <Chrome tone="muted" accessibilityRole="header" style={{ fontWeight: "600" }}>
          {moment.name}
        </Chrome>
      </View>

      {/* Clipped, so a passage swiped up leaves under its own edge, not under ‹ Search. */}
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
                contentContainerStyle={{ minHeight: height, justifyContent: "center", paddingHorizontal: gutter }}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                accessible
                accessibilityLabel={`${passageLabel(item)}. ${texts?.[i] ?? ""}`}
                accessibilityHint={i < moment.passages.length - 1 ? `Passage ${i + 1} of ${moment.passages.length}. Swipe up for the next` : `Passage ${i + 1} of ${moment.passages.length}, the last`}
              >
                {/* 30 pt, held to 48 at AX5 (the frame's .vmv2): larger runs the passage off its page. */}
                <Scripture style={{ fontSize: verseSize, lineHeight: Math.round(verseSize * 1.32), letterSpacing: -0.5 }} maxFontSizeMultiplier={1}>
                  {texts?.[i] === undefined ? "" : <DivineText text={opening(texts[i] ?? "", ax ? WORDS_AX : WORDS)} translation="BSB" />}
                </Scripture>
                <Chrome step="note" tone="muted" style={{ marginTop: ax ? 10 : 18, fontWeight: "600" }}>
                  {passageLabel(item)}
                </Chrome>
              </ScrollView>
            )}
          />
        ) : null}
      </View>

      <View style={{ paddingHorizontal: gutter, alignItems: "stretch", rowGap: ax ? 10 : 14 }}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {moment.passages.map((q, i) => (
            <View key={`${q.start}-${q.end}`} style={[styles.dot, { backgroundColor: i === index ? palette.ink : palette.divider }]} />
          ))}
        </View>
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
        {index === moment.passages.length - 1 ? (
          <Chrome step="note" tone="muted" style={{ textAlign: "center" }} testID="moment-last">
            {lastLine(moment)}
          </Chrome>
        ) : null}
        {passage !== undefined ? <Pill accent stretch title="Open in Bible" label={`Open ${passageLabel(passage)} in the Bible`} onPress={() => open(passage)} testID="moment-open" /> : null}
        <SourceLine center>{licensed ? "BSB · OpenBible.info" : "OpenBible.info"}</SourceLine>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", columnGap: 14, minHeight: 48 },
  dots: { flexDirection: "row", justifyContent: "center", columnGap: 7 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});

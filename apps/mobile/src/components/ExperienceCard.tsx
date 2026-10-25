/**
 * One thing to do today (TD-30; John, 24 Oct 2026: "why a timeline of verses as opposed to make it experiences for
 * humans on Today"). Named for what you do, its words in Literata, how long it takes with a play glyph, and a picture;
 * as YouVersion's Guided Scripture cards. Done, it fades: muted words, a tick and "Done", the picture dimmed. A fill
 * card, not raised: it is something to do, not something a person wrote (design-system.md). At AX sizes the picture
 * goes and the words take the width.
 */

import { type ImageSourcePropType, Pressable, StyleSheet, View } from "react-native";

import { FONTS, useLayout, usePalette } from "../design/tokens";
import { FillPicture } from "./FillPicture";
import { Icon } from "./Icon";
import { Chrome } from "./Type";

export function ExperienceCard({
  kicker,
  title,
  meta,
  image,
  done = false,
  onPress,
  testID,
}: {
  kicker: string;
  title: string;
  /** "5 min", or what stands in for a length where there is none. */
  meta: string;
  image: ImageSourcePropType | undefined;
  done?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kicker}. ${title}. ${done ? "Done" : meta}`}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.card, opacity: pressed ? 0.85 : 1 }]}
      testID={testID}
    >
      <View style={styles.words}>
        <Chrome step="note" tone="muted" style={{ fontWeight: "600" }} numberOfLines={ax ? undefined : 1}>
          {kicker}
        </Chrome>
        <Chrome tone={done ? "muted" : "ink"} style={styles.title} numberOfLines={ax ? 3 : 2} maxFontSizeMultiplier={2}>
          {title}
        </Chrome>
        <View style={styles.meta}>
          <Icon name={done ? "check" : "play"} size={14} tone={done ? "muted" : "ink"} filled={!done} />
          <Chrome step="note" tone={done ? "muted" : "ink"} style={{ fontWeight: "600" }}>
            {done ? "Done" : meta}
          </Chrome>
        </View>
      </View>
      {ax || image === undefined ? null : (
        <View style={[styles.thumb, { opacity: done ? 0.55 : 1, backgroundColor: palette.fill }]}>
          <FillPicture source={image} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", columnGap: 14, borderRadius: 24, padding: 14 },
  words: { flex: 1, minWidth: 0, rowGap: 4 },
  title: { fontFamily: FONTS.scripture, fontWeight: "400", fontSize: 21, lineHeight: 27 },
  meta: { flexDirection: "row", alignItems: "center", columnGap: 6, marginTop: 4 },
  thumb: { width: 88, height: 88, borderRadius: 16, overflow: "hidden" },
});

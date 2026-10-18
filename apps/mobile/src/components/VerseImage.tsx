/**
 * The square image made from a verse (PS-05, DR-18): the verse in Literata over the day's picture on a dark fade, or on
 * plain white or dark, with "John 3:16 · BSB" under it and, on a picture, who took it. Drawn at any size from the same
 * proportions, so the share sheet's 300 pt card and Saved › Images' thumbnails match what was shared, and nothing large
 * is stored (data/user.ts verse_images).
 */

import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DAY_PICTURES } from "../data/pictures.generated";
import { PALETTES } from "../design/palette";
import { FONTS } from "../design/tokens";
import type { ImageGround } from "../lib/highlights";
import { FillPicture } from "./FillPicture";

/** The canvas card is 300 pt; every size is drawn from it. */
const FRAME = 300;

export const VerseImage = forwardRef<View, { text: string; label: string; ground: ImageGround; pictureDay: number; size: number }>(function VerseImage(
  { text, label, ground, pictureDay, size },
  ref,
) {
  const k = size / FRAME;
  const picture = ground === "picture" || ground === "evening" ? DAY_PICTURES.find((p) => p.day === pictureDay && p.part === (ground === "evening" ? "evening" : "morning")) : undefined;
  // An image looks the same whatever the phone's appearance: the light palette's ink and paper, swapped on the dark
  // ground and under the picture's fade, as PS-05 draws them.
  const light = ground === "white";
  const { ink: dark, paper: white, edge } = PALETTES.light;
  const ink = light ? dark : white;
  // A long verse steps down so it never runs off the square.
  const fontSize = (text.length > 260 ? 13 : text.length > 160 ? 15 : 17) * k;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width: size, height: size, borderRadius: 18 * k, backgroundColor: light ? white : dark, borderColor: light ? edge : "transparent" }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${text} ${label}`}
    >
      {picture !== undefined ? (
        <>
          <FillPicture source={picture.image} />
          {/* The design system's fade: at least 86% dark under the words, so the verse reads on any picture. */}
          <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: "linear-gradient(rgba(14,14,12,0.05), rgba(14,14,12,0.35) 35%, rgba(14,14,12,0.88) 70%, rgba(14,14,12,0.94))" }]} />
        </>
      ) : null}
      <View style={[styles.words, { padding: 16 * k, rowGap: 6 * k }]}>
        <Text allowFontScaling={false} style={{ fontFamily: FONTS.scripture, fontSize, lineHeight: fontSize * 1.4, color: ink }}>
          {text}
        </Text>
        <Text allowFontScaling={false} style={{ fontSize: 9 * k, fontWeight: "600", color: ink, opacity: 0.9 }}>
          {label}
        </Text>
        {picture !== undefined ? (
          <Text allowFontScaling={false} style={{ fontSize: 7 * k, color: ink, opacity: 0.7 }}>{`Photo: ${picture.by}`}</Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, justifyContent: "flex-end" },
  words: { justifyContent: "flex-end" },
});

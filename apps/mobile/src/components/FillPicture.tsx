/**
 * A picture that fills its box, edge to edge: Today's hero, the day's verse, Return, Daily prayer and the share image.
 *
 * Sized by an explicit 100% width and height, never `StyleSheet.absoluteFill`: an <Image> given only its four edges
 * drew at a far larger size and showed a corner of the picture, cropped to the box (Earlier days and Today on the
 * simulator, 18 Oct 2026: day 18's stream under snowy peaks showed as a dark ridge). Its box must clip
 * (`overflow: "hidden"`), or a cover-scaled picture draws past it (the photo under Later on Today, the same day).
 * design/system.test.ts keeps `absoluteFill` off every Image.
 */

import { Image, type ImageSourcePropType, StyleSheet } from "react-native";

export function FillPicture({ source, alt }: { source: ImageSourcePropType; alt?: string }) {
  return (
    <Image
      source={source}
      style={styles.fill}
      resizeMode="cover"
      accessible={alt !== undefined}
      accessibilityLabel={alt}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
});

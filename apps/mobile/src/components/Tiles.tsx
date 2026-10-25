/**
 * Build 12's tiles (design-system.md, Build 12; John, 24 Oct 2026: "adopt the new ds proposals and adopt new youversion
 * patterns"). Each is one thing you tap. A picture tile puts a mood on a Yada photograph, the name in Literata on a fade,
 * as YouVersion's Guided Prayer topics do. A tint tile is a way to pray on one of four soft tints, the name in ink, so the
 * tint marks the category and never the word. A stat tile is one number with what it counts. They replace Pray's
 * mood chips, its fill-only `Way` tiles and Your rhythm's lead number.
 */

import type { ReactNode } from "react";
import { type ImageSourcePropType, Pressable, StyleSheet, View } from "react-native";

import { ON_PICTURE, type Tint } from "../design/palette";
import { FONTS, useLayout, usePalette } from "../design/tokens";
import { FillPicture } from "./FillPicture";
import { Icon, type IconName } from "./Icon";
import { Chrome } from "./Type";

/** Clear at the top, dark under the name (canvas `.ptile`). */
const FADE = "linear-gradient(rgba(0,0,0,0) 30%, rgba(0,0,0,0.6))";

export function PictureTile({
  title,
  image,
  onPress,
  label,
  wide = false,
  testID,
}: {
  title: string;
  image: ImageSourcePropType | undefined;
  /** The full width at every size: SE-32's one mood under "Did you mean", where a row of tiles would be one tile. */
  wide?: boolean;
  onPress: () => void;
  label?: string;
  testID?: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      style={({ pressed }) => [styles.picture, ax || wide ? styles.pictureAx : null, { backgroundColor: palette.card, opacity: pressed ? 0.85 : 1 }]}
      testID={testID}
    >
      {image !== undefined ? <FillPicture source={image} /> : null}
      <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: FADE }]} />
      {/* Padding on the words, not the tile: a percent-sized picture fills the content box, so tile padding left a
          margin of bare tile on two sides (12a QA, 24 Oct 2026). */}
      <Chrome style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400", padding: 12 }} size={19}>
        {title}
      </Chrome>
    </Pressable>
  );
}

export function TintTile({
  tint,
  icon,
  title,
  line,
  onPress,
  testID,
}: {
  tint: Tint;
  /** Without an icon and a line it is a need's name alone, as Bible prayers draws them (BP-30). */
  icon?: IconName;
  title: string;
  line?: string;
  onPress: () => void;
  testID?: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={line === undefined ? title : `${title}, ${line}`}
      style={({ pressed }) => [styles.tint, ax ? styles.tintAx : null, icon === undefined ? styles.tintName : null, { backgroundColor: palette.tints[tint], opacity: pressed ? 0.8 : 1 }]}
      testID={testID}
    >
      {icon === undefined ? null : <Icon name={icon} size={26} />}
      <View>
        <Chrome
          tone="ink"
          style={{ fontFamily: FONTS.scripture, fontWeight: "400" }}
          size={19}
          numberOfLines={ax ? undefined : 1}
          adjustsFontSizeToFit={!ax}
          minimumFontScale={0.85}
        >
          {title}
        </Chrome>
        {line === undefined ? null : (
          <Chrome step="note" tone="muted" style={{ marginTop: 3 }}>
            {line}
          </Chrome>
        )}
      </View>
    </Pressable>
  );
}

/** Two to a row; one at AX sizes. */
export function TileGrid({ children }: { children: ReactNode }) {
  const { ax } = useLayout();
  return <View style={[styles.grid, ax ? styles.gridAx : null]}>{children}</View>;
}

export function StatTile({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={[styles.stat, ax ? styles.tintAx : null, { backgroundColor: palette.card }]}>
      <Chrome step="note" tone="muted">
        {label}
      </Chrome>
      <Chrome tone="ink" style={styles.statValue} maxFontSizeMultiplier={1.6} testID={testID}>
        {value}
      </Chrome>
    </View>
  );
}

const styles = StyleSheet.create({
  picture: { width: 150, height: 104, borderRadius: 18, overflow: "hidden", justifyContent: "flex-end" },
  pictureAx: { width: "100%", height: 120 },
  tint: { width: "48.5%", minHeight: 118, borderRadius: 22, padding: 16, justifyContent: "space-between" },
  tintAx: { width: "100%", rowGap: 14 },
  tintName: { minHeight: 64, justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  gridAx: { flexDirection: "column" },
  stat: { width: "48.5%", borderRadius: 20, padding: 16 },
  statValue: { fontSize: 34, lineHeight: 40, fontWeight: "700", letterSpacing: -0.5, marginTop: 6, fontVariant: ["tabular-nums"] },
});

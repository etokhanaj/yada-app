/**
 * A translation's small portrait cover (plan, "Translation covers"; canvas
 * MT-02–06 `.cov`): Apple Books, Goodreads and Blinkist library lists. 40×56 pt,
 * 56×78 at AX sizes and top-aligned; a 4 pt darker spine with a light edge;
 * a soft drop shadow (a 1 pt light edge in dark mode); the abbreviation in
 * Literata semibold with a short rule beneath.
 *
 * Tone is identity, never state: the current version is marked by its row's
 * tick and semibold name. Decorative to VoiceOver, since the row names the version.
 */

import { StyleSheet, Text, View } from "react-native";

import { useIsDark } from "../design/tokens";
import { COVER_TONES, type CoverTone } from "../lib/translations";

export function TranslationCover({ code, tone, ax }: { code: string; tone: CoverTone; ax: boolean }) {
  const dark = useIsDark();
  const t = COVER_TONES[tone];
  const ground = dark ? (t.groundDark ?? t.ground) : t.ground;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.cover,
        ax ? styles.coverAx : null,
        {
          backgroundColor: ground,
          boxShadow: dark
            ? "0 0 0 1px rgba(255,255,255,0.08), 0 4px 10px rgba(0,0,0,0.4)"
            : "0 1px 2px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.12)",
        },
      ]}
    >
      {/* Clipped in its own layer, so the shadow outside the cover is not. */}
      <View style={styles.clip}>
        <View style={styles.spine} />
        <View style={styles.spineEdge} />
      </View>
      {/* Fixed size: the cover is a picture of a book, sized by the row, not a label. */}
      <Text allowFontScaling={false} style={[styles.code, { color: t.text, fontSize: ax ? 15 : 11 }]}>
        {code}
      </Text>
      <View style={[styles.rule, { backgroundColor: t.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: 40,
    height: 56,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 5,
  },
  clip: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    overflow: "hidden",
  },
  coverAx: {
    width: 56,
    height: 78,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  spine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  spineEdge: {
    position: "absolute",
    left: 4,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  code: {
    fontFamily: "Literata",
    fontWeight: "600",
    letterSpacing: 0.44,
    marginLeft: 3,
  },
  rule: {
    width: 14,
    height: 1,
    opacity: 0.5,
    marginLeft: 3,
  },
});

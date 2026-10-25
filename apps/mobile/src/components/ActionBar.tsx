/**
 * The reader's docked chrome (decision 2): the bar at rest, and a chosen verse's sheet.
 *
 * At rest (IA-04, RD-30, RestBar): `Understand 2:1–12`, the passage, is the primary action, with Listen beside it
 * (AU-01). Nothing else: chapter arrows here sat where the player's verse arrows sit and meant something else; the next
 * chapter is at the chapter's end (RD-33), the title opens every chapter (CH-30), and a swipe still turns.
 *
 * A chosen verse (RD-31, VerseSheet): one sheet docked to the bottom, in place of IA-05's two-row bar and its ⋯ menu.
 * The verse's reference and ×, the four highlight colours, Understand as the primary (Original when the verse has no
 * Understand, as the only way to its Greek), then Sit, Note, Share, Compare, Save and Play from as labelled tiles. Copy
 * lives in Share's native menu with Share as an image. A colour already on the selection is ringed in ink and a second
 * tap clears it. The page behind is not dimmed and the sheet is not modal: more verses are still tapped to widen the
 * selection, as before. Mobbin's reading apps fill the primary action with ink, not a brand colour (Deepstash,
 * https://mobbin.com/screens/780e563b-579c-4bf4-a941-4c4a550e3628); YouVersion's verse sheet puts the colours over
 * labelled actions. While audio plays the now-playing strip stays above it (John, 15 Oct 2026).
 *
 * To VoiceOver it comes after the verses and appearing does not move focus (brief §5).
 */

import { MenuView } from "@react-native-menu/menu";
import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS, SPRING, useLayout, usePalette } from "../design/tokens";
import { useReduceMotion } from "../lib/motion";
import type { OriginalLanguage } from "../lib/originalLanguage";
import { HIGHLIGHT_COLORS, type HighlightColor } from "../lib/highlights";
import { shareActions, type VerseTile, verseTiles } from "../lib/reader";
import { Icon, type IconName } from "./Icon";
import { Chrome } from "./Type";

/** Native menu glyphs are SF Symbols: UIMenu takes system images only. */
const MENU_IMAGES: Readonly<Record<string, string>> = {
  Share: "square.and.arrow.up",
  "Share as an image": "photo",
  Copy: "doc.on.doc",
};

export function VerseSheet({
  reference,
  verseLabel,
  hasEntry,
  bookmarked,
  script,
  language,
  onUnderstand,
  onOriginal,
  onAction,
  onClose,
  onHeight,
  playFrom = null,
  nowPlaying = null,
  highlight,
  imageable,
  sittable = false,
  onHighlight,
}: {
  /** "John 2:4" or "John 2:4–5": the sheet's title. */
  reference: string;
  /** "2:4" or "2:4–5". */
  verseLabel: string;
  hasEntry: boolean;
  bookmarked: boolean;
  script: "greek" | "hebrew";
  /** The selection's own language: Daniel 3 is Aramaic, though the book is set in Hebrew script. */
  language: OriginalLanguage;
  onUnderstand: () => void;
  /** Only offered when the verse has no Understand. */
  onOriginal: () => void;
  /** By the reader's lowercase action ids: sit with this, note, share, share as an image, copy, compare, bookmark. */
  onAction: (action: string) => void;
  /** × clears the selection. */
  onClose: () => void;
  onHeight: (height: number) => void;
  /** The chapter can be read aloud: Play from the selection's first verse (AU-03). */
  playFrom?: (() => void) | null;
  /** While audio plays: the now-playing strip above the sheet's contents (ReaderBars NowPlayingStrip). */
  nowPlaying?: ReactNode;
  /** The colour every selected verse already has, or null. */
  highlight: HighlightColor | null;
  /** Share as an image is offered (not for a licensed translation's words). */
  imageable: boolean;
  /** Sit with this is offered: an open translation and a short selection. */
  sittable?: boolean;
  /** A colour for the selection, or null to clear it. */
  onHighlight: (color: HighlightColor | null) => void;
}) {
  const palette = usePalette();
  const { ax, pill, control } = useLayout();
  const firstVerse = verseLabel.split(/[–-]/)[0] ?? verseLabel;
  const verseOnly = (label: string) => label.split(":")[1] ?? label;

  const primary = hasEntry ? (
    <Capsule primary height={pill} onPress={onUnderstand} label={`Understand verse ${verseOnly(verseLabel)}`} testID="bar-understand">
      <Chrome tone="paper" numberOfLines={1} style={{ fontWeight: "600" }}>
        Understand {verseLabel}
      </Chrome>
    </Capsule>
  ) : (
    <Capsule primary height={pill} onPress={onOriginal} label={`Original ${language}`} testID="bar-original">
      <Chrome
        tone="paper"
        style={{ fontFamily: script === "hebrew" ? FONTS.hebrew : FONTS.greek, fontSize: 21, lineHeight: 24, marginTop: -2 }}
        maxFontSizeMultiplier={1.4}
      >
        {script === "hebrew" ? "א" : "α"}
      </Chrome>
      <Chrome tone="paper" style={{ fontWeight: "600" }}>
        Original {language}
      </Chrome>
    </Capsule>
  );

  const swatches = (
    <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Highlight">
      {HIGHLIGHT_COLORS.map((color) => {
        const on = highlight === color;
        return (
          <Pressable
            key={color}
            onPress={() => onHighlight(on ? null : color)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`Highlight ${color}`}
            accessibilityHint={on ? "Removes the highlight" : undefined}
            style={styles.dot}
            testID={`bar-highlight-${color}`}
          >
            {/* RD-31's 40 pt swatch with a hairline inner ring; the colour on the selection is ringed in ink. */}
            <View style={[styles.swatch, { backgroundColor: palette.highlights[color], borderColor: on ? palette.ink : palette.edge, borderWidth: on ? 2 : 1 }]} />
          </Pressable>
        );
      })}
    </View>
  );

  const tileFace = (icon: IconName, title: string) => (
    <>
      <Icon name={icon} size={22} />
      <Chrome step="note" tone="ink" numberOfLines={1} style={{ fontWeight: "600" }} maxFontSizeMultiplier={2.2}>
        {title}
      </Chrome>
    </>
  );
  const tileStyle = [styles.tile, ax ? styles.tileAx : null, { backgroundColor: palette.fill }];
  const tile = (key: VerseTile, icon: IconName, title: string, label: string, onPress: () => void, testID: string, selected?: boolean) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [tileStyle, pressed ? { opacity: 0.72 } : null]}
      testID={testID}
    >
      {tileFace(icon, title)}
    </Pressable>
  );

  const tiles = verseTiles(sittable, playFrom !== null).map((key) => {
    switch (key) {
      case "sit":
        return tile(key, "sit", "Sit", `Sit with ${reference}`, () => onAction("sit with this"), "bar-sit");
      case "note":
        return tile(key, "note", "Note", `Note on ${reference}`, () => onAction("note"), "bar-note");
      case "compare":
        return tile(key, "compare", "Compare", `Compare translations of ${verseLabel}`, () => onAction("compare"), "bar-compare");
      case "save":
        // Saved, not "Remove bookmark": the tile says what is true, and VoiceOver hears that a second tap undoes it.
        return tile(key, "bookmark", bookmarked ? "Saved" : "Save", bookmarked ? `Saved, ${reference}. Removes the bookmark` : `Save ${reference}`, () => onAction("bookmark"), "bar-save", bookmarked);
      case "play":
        return tile(key, "play", "Play from", `Play from verse ${verseOnly(firstVerse)}`, () => playFrom?.(), "bar-play-from");
      case "share":
        return (
          <MenuView
            key={key}
            style={[styles.tileSlot, ax ? styles.tileAx : null]}
            shouldOpenOnLongPress={false}
            // imageColor always set: without it @react-native-menu draws the glyph transparent (index.tsx, 10 Oct 2026).
            actions={shareActions(imageable).map((title) => ({ id: title.toLowerCase(), title, image: MENU_IMAGES[title], imageColor: palette.ink }))}
            onPressAction={({ nativeEvent }) => onAction(nativeEvent.event)}
            testID="bar-share"
          >
            {/* The menu is a UIButton; a child that took the touch would keep it from opening. */}
            <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel={imageable ? "Share, as an image, or Copy" : "Share or Copy"} style={[tileStyle, styles.tileFill]}>
              {tileFace("share", "Share")}
            </View>
          </MenuView>
        );
    }
  });

  return (
    <BarFrame onHeight={onHeight} testID="verse-sheet" sheet>
      {nowPlaying}
      <View style={styles.head}>
        <Chrome step="sheetTitle" tone="ink" accessibilityRole="header" style={{ flex: 1 }}>
          {reference}
        </Chrome>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityHint="Clears the chosen verses"
          testID="bar-close"
          // The sheet's own round control: white with a hairline ring (polish-2026-10-15.md).
          style={({ pressed }) => [styles.round, { width: control, height: control, backgroundColor: palette.sheet, borderColor: palette.edge, opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="close" size={18} strokeWidth={2.2} />
        </Pressable>
      </View>
      {swatches}
      <View style={{ rowGap: 10 }}>
        {primary}
        <View style={styles.tiles}>{tiles}</View>
      </View>
    </BarFrame>
  );
}

/**
 * The bar at rest (IA-04): the passage on screen, named by its range, opens
 * its guide. `audio` is package E's Listen (AU-01), beside it; in a book with
 * no passages Listen is the bar alone.
 */
export function RestBar({
  passage,
  onHeight,
  audio,
}: {
  passage: {
    /** "1:1–18" */
    range: string;
    /** "The Word became flesh, John 1:1 to 18": what VoiceOver hears after "Understand the passage". */
    label: string;
    onUnderstand: () => void;
  } | null;
  onHeight: (height: number) => void;
  audio?: ReactNode;
}) {
  const { ax, pill } = useLayout();
  return (
    <BarFrame onHeight={onHeight} testID="rest-bar">
      <View style={ax ? { rowGap: 8 } : styles.row}>
        {passage === null ? null : (
          <Capsule
            primary
            grow
            height={pill}
            onPress={passage.onUnderstand}
            label={`Understand the passage, ${passage.label}`}
            hint="Opens the passage guide"
            testID="rest-understand"
          >
            <Chrome tone="paper" numberOfLines={1} style={{ fontWeight: "600" }}>
              Understand {passage.range}
            </Chrome>
          </Capsule>
        )}
        {audio}
      </View>
    </BarFrame>
  );
}

/**
 * The docked bar's ground: the reader's bars, and a page's pinned primary action (PageScreen `footer`, Sit with a verse).
 * `sheet`: RD-31's verse sheet, on the sheet ground with its 28 pt top corners; the hairline stays, since in light the
 * sheet and the page are both white and nothing dims behind it.
 */
export function BarFrame({ children, onHeight, testID, sheet = false }: { children: ReactNode; onHeight: (height: number) => void; testID: string; sheet?: boolean }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    // Critically damped: overshoot on something that merely appeared reads as decoration.
    if (!reduceMotion) Animated.spring(enter, { toValue: 1, ...SPRING.standard, useNativeDriver: true }).start();
  }, [enter, reduceMotion]);
  return (
    <Animated.View
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      style={[
        styles.bar,
        {
          backgroundColor: sheet ? palette.sheet : palette.paper,
          boxShadow: `0 -1px 0 ${palette.divider}`,
          ...(sheet ? styles.sheet : null),
          paddingBottom: Math.max(insets.bottom, 12),
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}

/** A bar capsule: `grow` shares the row, `square` is a glyph-only control as wide as it is tall. */
export function Capsule({
  children,
  primary = false,
  grow = false,
  square = false,
  height,
  onPress,
  label,
  hint,
  testID,
  selected,
}: {
  children: ReactNode;
  /** A capsule that toggles (Sit's rain): VoiceOver hears whether it is on. */
  selected?: boolean;
  primary?: boolean;
  grow?: boolean;
  square?: boolean;
  height: number;
  onPress: () => void;
  label: string;
  hint?: string;
  testID: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      testID={testID}
      style={({ pressed }) => [
        styles.capsule,
        ax ? styles.wide : square ? { width: height } : grow ? styles.cell : null,
        ax ? styles.list : { height },
        { minHeight: height, backgroundColor: primary ? palette.ink : palette.fill },
        pressed ? { opacity: 0.72 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    columnGap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  wide: {
    alignSelf: "stretch",
  },
  capsule: {
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 12,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    rowGap: 12,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  round: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  swatches: {
    flexDirection: "row",
    columnGap: 4,
    marginLeft: -2,
  },
  dot: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  // Three to a row, two at AX sizes (RD-31).
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
  },
  tile: {
    width: "31.5%",
    minHeight: 64,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 6,
  },
  tileAx: {
    width: "48.5%",
  },
  // Share's menu wraps the tile, so the wrapper takes the tile's width and the tile fills it.
  tileSlot: {
    width: "31.5%",
  },
  tileFill: {
    width: "100%",
  },
  list: {
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
});

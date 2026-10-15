/**
 * The reader's bar, docked to the bottom (decision 2; canvas IA-04, IA-05,
 * J01-15). Replaces the floating SelectionPill, which covered the verse it
 * acted on (0A).
 *
 * At rest (IA-04, RestBar): `Understand 1:1–18`, the passage, is the primary
 * action. On a selected verse (IA-05, ActionBar): one row, `Understand 1:1`
 * in ink, then Compare and `⋯`. Original leaves the bar (lib/reader.ts
 * barItems). Mobbin's reading apps fill the primary action with ink, not a
 * brand colour (Deepstash,
 * https://mobbin.com/screens/780e563b-579c-4bf4-a941-4c4a550e3628; Crouton's
 * docked pill, https://mobbin.com/screens/bfb5df79-f490-45d3-b573-35d72f6ff3c8).
 * `⋯` is the native iOS menu (Apple Books,
 * https://mobbin.com/screens/fda02365-2264-4eff-a55e-7850616e58bf). At AX sizes
 * the actions stack as a list of two, so the bar never covers the verse
 * (amendment 4).
 *
 * Audio (package E): at rest Listen sits in RestBar's `audio` slot (AU-01).
 * When the chapter can be read aloud, `playFrom` is set and the selection bar
 * adds `▶ 1:6` as a secondary capsule before Understand, or `Play from 1:6`
 * second in the AX list (AU-03). A tap in the reader still means "select", so
 * jumping the audio is one tap from there (John, 11 Oct 2026). Original stays
 * out of the bar and out of `⋯` while playing too: IA-05 drops it for good, and
 * Understand opens it in place.
 *
 * Paper ground, hairline top, no shadow. To VoiceOver it comes after the
 * verses and appearing does not move focus (brief §5).
 */

import { MenuView } from "@react-native-menu/menu";
import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS, SPRING, useLayout, usePalette } from "../design/tokens";
import { useReduceMotion } from "../lib/motion";
import type { OriginalLanguage } from "../lib/originalLanguage";
import { type BarItem, barItems, moreActions } from "../lib/reader";
import { MediaIcon } from "./audio/MediaIcon";
import { Icon } from "./Icon";
import { Chrome } from "./Type";

/** Native menu glyphs are SF Symbols: UIMenu takes system images only. */
const MENU_IMAGES: Readonly<Record<string, string>> = {
  Compare: "rectangle.split.2x1",
  Copy: "doc.on.doc",
  Share: "square.and.arrow.up",
  Bookmark: "bookmark",
  "Remove bookmark": "bookmark.slash",
};

export function ActionBar({
  verseLabel,
  hasEntry,
  bookmarked,
  script,
  language,
  onUnderstand,
  onOriginal,
  onCompare,
  onMenu,
  onHeight,
  playFrom = null,
  nowPlaying = null,
}: {
  /** "14:34" or "14:34–35". */
  verseLabel: string;
  hasEntry: boolean;
  bookmarked: boolean;
  script: "greek" | "hebrew";
  /** The selection's own language: Daniel 3 is Aramaic, though the book is set in Hebrew script. */
  language: OriginalLanguage;
  onUnderstand: () => void;
  /** Only offered when the verse has no Understand (lib/reader.ts barItems). */
  onOriginal: () => void;
  onCompare: () => void;
  /** Copy, Share, Bookmark / Remove bookmark (and Compare at AX sizes). */
  onMenu: (action: string) => void;
  onHeight: (height: number) => void;
  /** The chapter can be read aloud: offer Play from the selection's first verse, first in the row, second in the AX list (AU-03). */
  playFrom?: (() => void) | null;
  /** While audio plays: the now-playing strip above the actions (ReaderBars NowPlayingStrip). */
  nowPlaying?: ReactNode;
}) {
  const palette = usePalette();
  const { ax, pill } = useLayout();
  const items = barItems(hasEntry, ax);
  const menu = moreActions(hasEntry, ax, bookmarked);
  const firstVerse = verseLabel.split(/[–-]/)[0] ?? verseLabel;

  const originalName = `Original ${language}`;

  const audio =
    playFrom === null ? null : (
      // In the row, ▶ alone: "▶ 14:33" beside "Understand 14:33" said the verse twice and cut Understand to
      // "Understand 1…" (UX pass, 15 Oct 2026). The selected verse is in view; VoiceOver hears which verse.
      <Capsule key="play" square={!ax} height={pill} onPress={playFrom} label={`Play from verse ${firstVerse.split(":")[1] ?? firstVerse}`} testID="bar-play-from">
        {ax ? (
          <>
            <Chrome tone="ink" style={{ fontWeight: "500", flex: 1 }}>
              {`Play from ${firstVerse}`}
            </Chrome>
            <MediaIcon name="play" size={30} maxScale={1} />
          </>
        ) : (
          <MediaIcon name="play" size={18} maxScale={1} />
        )}
      </Capsule>
    );

  const button = (item: BarItem) => {
    if (item === "understand") {
      return (
        <Capsule
          key={item}
          primary
          grow
          height={pill}
          onPress={onUnderstand}
          label={`Understand verse ${verseLabel.split(":")[1] ?? verseLabel}`}
          testID="bar-understand"
        >
          <Chrome tone="paper" numberOfLines={1} style={{ fontWeight: "600" }}>
            Understand {verseLabel}
          </Chrome>
        </Capsule>
      );
    }
    if (item === "original") {
      return (
        <Capsule key={item} grow height={pill} onPress={onOriginal} label={originalName} testID="bar-original">
          {ax ? null : (
            <Chrome
              tone="ink"
              style={{ fontFamily: script === "hebrew" ? FONTS.hebrew : FONTS.greek, fontSize: 21, lineHeight: 24, marginTop: -2 }}
              maxFontSizeMultiplier={1.4}
            >
              {script === "hebrew" ? "א" : "α"}
            </Chrome>
          )}
          <Chrome tone="ink" style={{ fontWeight: "500" }}>
            Original
          </Chrome>
        </Capsule>
      );
    }
    if (item === "compare") {
      // IA-05: beside Understand, Compare is its glyph alone; it keeps its word when Original
      // shares the row (no Understand), as J01-15 drew it.
      return (
        <Capsule key={item} grow={!hasEntry} square={hasEntry} height={pill} onPress={onCompare} label={`Compare translations of ${verseLabel}`} testID="bar-compare">
          <Icon name="compare" size={hasEntry ? 18 : 16} />
          {hasEntry ? null : (
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              Compare
            </Chrome>
          )}
        </Capsule>
      );
    }
    return (
      <MenuView
        key={item}
        style={ax ? styles.wide : hasEntry || playFrom !== null ? { width: pill } : styles.cell}
        shouldOpenOnLongPress={false}
        actions={menu.map((title) => ({ id: title.toLowerCase(), title, image: MENU_IMAGES[title] }))}
        onPressAction={({ nativeEvent }) => onMenu(nativeEvent.event)}
        testID="bar-more"
      >
        {/* The menu is a UIButton; a child that took the touch would keep it from opening.
            VoiceOver still focuses the child, and its activation tap falls through. */}
        <View
          pointerEvents="none"
          accessible
          accessibilityRole="button"
          accessibilityLabel="More actions"
          style={[styles.capsule, { height: ax ? undefined : pill, minHeight: pill, backgroundColor: palette.fill }, ax ? styles.list : null]}
        >
          {ax ? (
            <Chrome tone="ink" style={{ fontWeight: "500", flex: 1 }}>
              More
            </Chrome>
          ) : null}
          <Icon name="more" size={22} />
        </View>
      </MenuView>
    );
  };

  const [first, ...rest] = items.map(button);
  return (
    <BarFrame onHeight={onHeight} testID="action-bar">
      {nowPlaying}
      {ax ? (
        <View style={{ rowGap: 8 }}>
          {first}
          {audio}
          {rest}
        </View>
      ) : (
        <View style={styles.row}>
          {audio}
          {first}
          {rest}
        </View>
      )}
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

function BarFrame({ children, onHeight, testID }: { children: ReactNode; onHeight: (height: number) => void; testID: string }) {
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
          backgroundColor: palette.paper,
          boxShadow: `0 -1px 0 ${palette.divider}`,
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
}: {
  children: ReactNode;
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
  list: {
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
});

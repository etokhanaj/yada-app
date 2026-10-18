/**
 * Page screens (Home, Bookmarks, Recent, Start here, Sources): glass controls
 * over a paper fade, a serif large title, hairline rows. Apple Books Home
 * (https://mobbin.com/screens/ef25171d-f4a6-43ed-a0a2-375e835230f8) and
 * Tolan's serif display (https://mobbin.com/screens/20fa5ed2-c94e-4822-8e20-745cdaa93029).
 *
 * Every exit names its destination (brief §1 rule 4): `‹ Home`, never `‹ Back`.
 */

import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { transparent } from "../design/contrast";
import { useLayout, usePalette, useType, WIDE } from "../design/tokens";
import { useTabBarClearance } from "./TabBar";
import { GlassButton } from "./Glass";
import { Icon, type IconName } from "./Icon";
import { Chrome, useFontScaleKey } from "./Type";


/** Page titles in SF bold with tight tracking; serif stays for Scripture, passage titles and book names (polish-2026-10-15.md). */
function LargeTitle({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const t = useType("pageTitle");
  const key = useFontScaleKey();
  return (
    <Text
      key={key}
      accessibilityRole="header"
      maxFontSizeMultiplier={t.maxFontSizeMultiplier}
      style={{
        fontFamily: t.fontFamily,
        fontSize: t.size,
        lineHeight: t.lineHeight,
        letterSpacing: t.tracking,
        fontWeight: "700",
        color: palette.ink,
      }}
    >
      {children}
    </Text>
  );
}

export function GlassIcon({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  return (
    <GlassButton onPress={onPress} accessibilityLabel={label} testID={testID}>
      <Icon name={icon} size={icon === "more" ? 20 : 18} />
    </GlassButton>
  );
}

export function PageScreen({
  title,
  back = "Bible",
  right,
  children,
  subtitle,
  testID,
  titleNode,
  clearTabBar = false,
}: {
  title: string;
  /** BH-01: the last row scrolls clear of the native tab bar (Today sat over Deuteronomy in the TestFlight build). */
  clearTabBar?: boolean;
  /** Drawn in place of the large title: Home's wordmark. `title` still names the page in the bar. */
  titleNode?: ReactNode;
  /** null on Home itself. */
  back?: string | null;
  right?: ReactNode;
  children: ReactNode;
  /** A string is set as a muted note; a node (Start here's word line, DP-03) is drawn as given. */
  subtitle?: ReactNode;
  testID?: string;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const { gutter: phoneGutter, regular, tabs } = useLayout();
  // TB-03: a regular-width page keeps TB-01's 36 pt margin and its rows to a column, centred when the window is wider.
  const gutter = regular ? WIDE.gutter : phoneGutter;
  const column = regular ? ({ width: "100%", maxWidth: WIDE.page + 2 * gutter, alignSelf: "center" } as const) : null;
  // A tab page under iPadOS's top tabs (TB-03 portrait): the capsule has already taken the status bar's room.
  const top = clearTabBar && tabs === "top" ? 0 : insets.top;
  const [barHeight, setBarHeight] = useState(top + 60);
  const [titleBottom, setTitleBottom] = useState(120);
  const [scrolled, setScrolled] = useState(false);
  // The bar's title sits centred clear of the wider side. Fixed 100 pt insets let it run under
  // `‹ Home` and the glass buttons once they grew at AX5 (Bookmarks and Home, 11 Oct 2026).
  // Widths are read before setSides: the layout event is gone by the time an updater runs
  // ("Cannot read property 'layout' of null", simulator, 11 Oct 2026).
  const [sides, setSides] = useState({ left: 0, right: 0, row: 0 });
  const inset = Math.max(sides.left, sides.right) + 8;
  const titleFits = sides.row - 2 * inset >= 80;
  const measure = (side: keyof typeof sides) => (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setSides((v) => ({ ...v, [side]: width }));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // The title moves into the bar once the large one has scrolled under it (SO-02).
    setScrolled(e.nativeEvent.contentOffset.y + barHeight > titleBottom);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }} testID={testID}>
      {/* Drawn first so VoiceOver meets the controls before the page, as the eye does (ON-06);
          zIndex keeps it above the scrolling content. */}
      <View pointerEvents="box-none" style={styles.bar} onLayout={(e) => setBarHeight(e.nativeEvent.layout.height - 22)}>
        <View style={{ paddingTop: top + 4, paddingHorizontal: regular ? gutter - 8 : 12, paddingBottom: 6, backgroundColor: palette.paper }}>
          <View style={[styles.row, regular ? { width: "100%", maxWidth: WIDE.page + 16, alignSelf: "center" } : null]} onLayout={measure("row")}>
            <View onLayout={measure("left")}>
              {back !== null ? (
                <GlassButton
                  shape="capsule"
                  onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                  accessibilityLabel={back}
                  testID="page-back"
                >
                  <Icon name="back" size={18} tone="muted" />
                  <Chrome tone="ink" style={{ fontWeight: "500", marginRight: 2 }}>
                    {back}
                  </Chrome>
                </GlassButton>
              ) : null}
            </View>
            {scrolled && titleFits ? (
              <Chrome step="sheetTitle" tone="ink" numberOfLines={1} style={[styles.inline, { left: inset, right: inset }]} accessibilityElementsHidden>
                {title}
              </Chrome>
            ) : null}
            <View style={styles.right} onLayout={measure("right")}>
              {right}
            </View>
          </View>
        </View>
        <View style={{ height: 22, experimental_backgroundImage: `linear-gradient(${palette.paper}, ${transparent(palette.paper)})` }} />
      </View>

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={32}
        // The tab bar's clearance already reaches past the home indicator (TabBar pads its own foot by insets.bottom),
        // so a tab page pads by it alone, as Today does; adding insets.bottom left a tab page 34 pt taller at the foot.
        contentContainerStyle={[{ paddingTop: barHeight + 14, paddingHorizontal: gutter, paddingBottom: clearTabBar ? tabClearance : insets.bottom + 48 }, column]}
        keyboardDismissMode="on-drag"
      >
        <View onLayout={(e) => setTitleBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          {titleNode ?? <LargeTitle>{title}</LargeTitle>}
          {typeof subtitle === "string" ? (
            <Chrome step="note" tone="muted" style={{ marginTop: 4 }}>
              {subtitle}
            </Chrome>
          ) : (
            subtitle
          )}
        </View>
        <View style={{ marginTop: 18 }}>{children}</View>
      </ScrollView>
    </View>
  );
}

/**
 * A list row: the whole row is the target, one hairline between neighbours,
 * a trailing chevron. `book` sets the main line in Literata, as book names are.
 */
export function ListRow({
  title,
  subtitle,
  overline,
  right,
  onPress,
  first = false,
  book = false,
  here = false,
  chosen = false,
  done = false,
  label,
  testID,
  chevron = true,
  children,
  actions,
  onAction,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Small muted line above the title: a reference over its verse. */
  overline?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  book?: boolean;
  /**
   * Start here's Next: title semibold, and nothing else here. The wash and bar mean one thing
   * only, a selected verse (John, 10 Oct 2026); a plan's next item is marked in type, as
   * Babbel and Uxcel mark theirs with a label rather than a fill
   * (https://mobbin.com/screens/2f1af114-b64e-40b9-9434-97d7114bd4fc,
   * https://mobbin.com/screens/dba87d9e-9955-49be-be73-686477e601ee).
   */
  here?: boolean;
  /** The chosen one of a set, Contents' current book: tick + semibold, no wash (MT-01, C-01). */
  chosen?: boolean;
  done?: boolean;
  label?: string;
  testID?: string;
  chevron?: boolean;
  children?: ReactNode;
  /** VoiceOver's way to do what a drag does: Compare's Choose moves a version up or down (CP-06). */
  actions?: ReadonlyArray<{ name: string; label: string }>;
  onAction?: (name: string) => void;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      unstable_pressDelay={60}
      accessibilityRole={onPress === undefined ? undefined : "button"}
      accessibilityLabel={label}
      accessibilityState={chosen ? { selected: true } : undefined}
      accessibilityActions={actions}
      onAccessibilityAction={onAction === undefined ? undefined : (e) => onAction(e.nativeEvent.actionName)}
      testID={testID}
      style={({ pressed }) => [
        styles.listRow,
        first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.divider },
        pressed ? { backgroundColor: palette.fill } : null,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, rowGap: 3 }}>
        {overline !== undefined ? (
          <Chrome step="note" tone="muted" style={{ fontWeight: "500" }}>
            {overline}
          </Chrome>
        ) : null}
        {title !== undefined ? (
          book ? (
            <Chrome
              tone={done ? "muted" : "ink"}
              // 20 pt, reaching 44 at AX5 (canvas --lrow).
              style={{ fontFamily: "Literata", fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontWeight: here || chosen ? "600" : "400" }}
              maxFontSizeMultiplier={2.2}
              // At AX5 "1 Corinthians" beside the tick broke as "Corinthian / s" (sweep, 10 Oct 2026).
              // Two lines and a slight shrink keep every book name's words whole.
              numberOfLines={ax ? 2 : undefined}
              adjustsFontSizeToFit={ax}
              minimumFontScale={0.7}
            >
              {title}
            </Chrome>
          ) : (
            <Chrome tone={done ? "muted" : "ink"} style={{ fontWeight: here || chosen ? "600" : "400" }}>
              {title}
            </Chrome>
          )
        ) : null}
        {subtitle !== undefined ? (
          typeof subtitle === "string" ? (
            <Chrome step="note" tone="muted">
              {subtitle}
            </Chrome>
          ) : (
            subtitle
          )
        ) : null}
        {children}
      </View>
      {right}
      {chevron && onPress !== undefined ? <Icon name="forward" size={18} tone="muted" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 8,
  },
  right: {
    flexDirection: "row",
    columnGap: 8,
  },
  inline: {
    position: "absolute",
    textAlign: "center",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    // 56 pt rows (polish-2026-10-15.md: "more air").
    minHeight: 56,
    paddingVertical: 15,
  },
});

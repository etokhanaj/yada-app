/**
 * The tab bar we draw (IA-15, IA-17): Today and Bible in one glass capsule, Search as the round glass button beside it,
 * and, while listening, the mini player riding above both. Values from the canvas (`.tabs`, `.tbar`, `.tbi`, `.tbs`,
 * `.tacc`).
 *
 * It replaces iOS 26's native tab bar (expo-router/unstable-native-tabs), which on build 10 drew no glass, took no
 * taps (they reached the page under it, so a tap on Today's picture could open a book) and drew a stray piece of the
 * picture at the foot of Today (simulator and John's iPhone, 18 Oct 2026; docs/build-qa-lessons.md). John chose to
 * replace it. The shapes are iOS 26's own, as Photos draws them on the same simulator: a capsule of tabs, the selected
 * one on a soft fill, and the round button apart (Shopify,
 * https://mobbin.com/screens/904d082d-43f9-44c5-b3ed-97d26af9bad2; Pool,
 * https://mobbin.com/screens/ffc3b406-b9a4-4164-ba03-a1554b27b8dc).
 *
 * The bar floats over the page; each tab page pads its foot by `useTabBarClearance()` so its last row scrolls clear.
 *
 * In a regular-width window (iPad, an open Duo; build 10) the same tabs are drawn where iPadOS draws them, chosen by
 * the window's shape (design/wide.ts): beside the page as a sidebar when it is wider than tall (TB-01 and TB-03
 * landscape, DU-01 open), with Saved's Highlights, Notes and Your reading under it; as a capsule at the top when it is
 * taller (TB-01 and TB-03 portrait). Neither floats: the tabs layout gives them their own room (`tabBarPosition`), so
 * no page runs under them. The mini player goes to the sidebar's foot, or under the top capsule.
 */

import { router } from "expo-router";
import { create } from "zustand";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { sidebarWidthFor, useLayout, usePalette } from "../design/tokens";
import { TabsPlayer, useTabsPlayerShown } from "./audio/TabsPlayer";
import { GlassSurface } from "./Glass";
import { Icon } from "./Icon";
import { Chrome } from "./Type";

type TabName = "today" | "index" | "pray" | "search";

/** The tabs, in the bar's order; Search is the round button apart (IA-15). Pray joined them on 24 Oct 2026 (PT-46). */
const TABS = [
  { name: "today", label: "Today" },
  { name: "index", label: "Bible" },
  { name: "pray", label: "Pray" },
] as const;

/** All three, in the sidebar's and the top capsule's order (TB-01): there Search is a tab like the others. */
const ALL = [...TABS, { name: "search", label: "Search" }] as const;

/**
 * Saved's lists under the sidebar's tabs (TB-01 `.sbh`, `.sbi.sm`): each opens Saved on that list, its back capsule
 * naming the tab it came from, or Your rhythm.
 */
const SAVED = [
  { label: "Highlights", testID: "sidebar-highlights", open: (back: string) => router.push({ pathname: "/saved", params: { tab: "highlights", back } }) },
  { label: "Notes", testID: "sidebar-notes", open: (back: string) => router.push({ pathname: "/saved", params: { tab: "notes", back } }) },
  { label: "Your reading", testID: "sidebar-reading", open: () => router.push("/rhythm") },
] as const;

/**
 * Room a tab page leaves at its foot: the bar, and the mini player too while it shows (IA-17). The sidebar and the top
 * capsule take their own room, so a regular-width page needs only a margin there.
 */
// The floating bar's measured height, mini player included. A fixed 176 left Today's Read and Listen under the
// player at AX5, where the player alone is about 120 pt (fresh-eyes review RU-12, 23 Oct 2026).
const useBottomBarHeight = create<{ height: number }>(() => ({ height: 0 }));

export function useTabBarClearance(): number {
  const listening = useTabsPlayerShown();
  const { tabs } = useLayout();
  const measured = useBottomBarHeight((s) => s.height);
  if (tabs !== "bottom") return 32;
  // Before the first layout, the old fixed values; after it, the bar's own height and a little air.
  if (measured === 0) return listening ? 176 : 120;
  return measured + 16;
}

export function TabBar(props: BottomTabBarProps) {
  const { tabs } = useLayout();
  if (tabs === "side") return <SideBar {...props} />;
  if (tabs === "top") return <TopTabs {...props} />;
  return <BottomBar {...props} />;
}

function useGo({ state, navigation }: BottomTabBarProps) {
  const current = state.routes[state.index]?.name;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (route === undefined) return;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) navigation.navigate(route.name);
  };
  return { current, go };
}

const testIDFor = (name: TabName) => `tab-${name === "index" ? "bible" : name}`;

/**
 * TB-01 landscape, DU-01 open: the sidebar (`.sbar2`) on the card fill, each tab a 44 pt row with its glyph, the
 * selected one on a soft fill in the accent; then Saved's lists, smaller and muted. iPadOS's own sidebar, as Photos
 * and Music draw it.
 */
function SideBar(props: BottomTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listening = useTabsPlayerShown();
  const { current, go } = useGo(props);
  return (
    <View
      style={[
        styles.side,
        {
          width: sidebarWidthFor(width) + insets.left,
          paddingLeft: 12 + insets.left,
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: palette.card,
        },
      ]}
      testID="tab-sidebar"
    >
      <View accessibilityRole="tablist" style={styles.sideTabs}>
        {ALL.map((tab) => {
          const selected = current === tab.name;
          const tone = selected ? palette.accent : palette.ink;
          return (
            <Pressable
              key={tab.name}
              onPress={() => go(tab.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
              style={({ pressed }) => [styles.sideItem, selected || pressed ? { backgroundColor: palette.fill } : null]}
              testID={testIDFor(tab.name)}
            >
              <TabGlyph name={tab.name} color={tone} />
              <Chrome style={{ color: tone, fontWeight: selected ? "600" : "500", flexShrink: 1 }} maxFontSizeMultiplier={1.6}>
                {tab.label}
              </Chrome>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.sideRule, { backgroundColor: palette.divider }]} />
      <Chrome step="note" tone="muted" accessibilityRole="header" style={styles.sideHead} maxFontSizeMultiplier={1.6}>
        Saved
      </Chrome>
      {SAVED.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => item.open(ALL.find((t) => t.name === current)?.label ?? "Bible")}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={({ pressed }) => [styles.sideItem, pressed ? { backgroundColor: palette.fill } : null]}
          testID={item.testID}
        >
          <Chrome tone="muted" style={{ fontSize: 15, lineHeight: 20, flexShrink: 1 }} maxFontSizeMultiplier={1.6}>
            {item.label}
          </Chrome>
        </Pressable>
      ))}
      <View style={styles.grow} />
      {listening ? (
        <GlassSurface>
          <TabsPlayer />
        </GlassSurface>
      ) : null}
    </View>
  );
}

/**
 * TB-01 and TB-03 portrait: iPadOS's tabs at the top (`.toptabs`), one glass capsule centred over the page, each tab
 * its glyph beside its label; while listening, the mini player under it.
 */
function TopTabs(props: BottomTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const listening = useTabsPlayerShown();
  const { current, go } = useGo(props);
  return (
    <View style={[styles.top, { paddingTop: insets.top + 8, backgroundColor: palette.paper }]} testID="tab-top">
      <GlassSurface>
        <View style={styles.bar} accessibilityRole="tablist">
          {ALL.map((tab) => {
            const selected = current === tab.name;
            const tone = selected ? palette.accent : palette.ink;
            return (
              <Pressable
                key={tab.name}
                onPress={() => go(tab.name)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={tab.label}
                style={[styles.topTab, selected ? { backgroundColor: palette.fill } : null]}
                testID={testIDFor(tab.name)}
              >
                <TabGlyph name={tab.name} color={tone} />
                {/* `.toptabs .tbi`: 14 pt semibold beside the glyph. */}
                <Chrome style={{ color: tone, fontSize: 14, lineHeight: 18, fontWeight: "600" }} maxFontSizeMultiplier={1.6}>
                  {tab.label}
                </Chrome>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
      {listening ? (
        <View style={styles.topPlayer}>
          <GlassSurface>
            <TabsPlayer />
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}

function BottomBar(props: BottomTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { ax } = useLayout();
  const listening = useTabsPlayerShown();
  const { current, go } = useGo(props);

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => useBottomBarHeight.setState({ height: Math.round(e.nativeEvent.layout.height) })}
      style={[
        styles.root,
        // `.tabs`: the page fades to paper behind the bar, so text never runs under it unreadably.
        { paddingBottom: Math.max(insets.bottom - 8, 12), experimental_backgroundImage: `linear-gradient(${palette.paper}00, ${palette.paper} 40%)` },
      ]}
    >
      {listening ? (
        <GlassSurface>
          <TabsPlayer />
        </GlassSurface>
      ) : null}
      <View style={styles.row}>
        <View style={styles.grow}>
          <GlassSurface>
            <View style={styles.bar} accessibilityRole="tablist">
              {TABS.map((tab) => {
                const selected = current === tab.name;
                const tone = selected ? palette.accent : palette.ink;
                return (
                  <Pressable
                    key={tab.name}
                    onPress={() => go(tab.name)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={tab.label}
                    style={[styles.tab, ax ? styles.tabAx : null, selected ? { backgroundColor: palette.fill } : null]}
                    testID={testIDFor(tab.name)}
                  >
                    <TabGlyph name={tab.name} color={tone} />
                    {/* `.tbi`: 11 pt semibold under the glyph, 15 beside it at AX sizes. */}
                    <Chrome step="note" style={{ color: tone, fontSize: ax ? 15 : 11, lineHeight: ax ? 20 : 13, fontWeight: "600" }} maxFontSizeMultiplier={1.4}>
                      {tab.label}
                    </Chrome>
                  </Pressable>
                );
              })}
            </View>
          </GlassSurface>
        </View>
        <GlassSurface>
          <Pressable
            onPress={() => go("search")}
            accessibilityRole="button"
            accessibilityState={{ selected: current === "search" }}
            accessibilityLabel="Search"
            style={[styles.search, ax ? styles.searchAx : null]}
            testID="tab-search"
          >
            <Icon name="search" size={24} tone={current === "search" ? "accent" : "ink"} maxScale={1.3} />
          </Pressable>
        </GlassSurface>
      </View>
    </View>
  );
}

/**
 * The canvas's own tab glyphs (IA-15): a sun on the horizon for Today, an open book for Bible, a heart in a hand for
 * Pray (PT-46); 1.6 stroke. Search's lens is TB-01's, at 2.
 */
function TabGlyph({ name, color }: { name: TabName; color: string }) {
  // Pray's is the heart in a hand Pray for others uses: drawn hands read as a second open book beside Bible's.
  if (name === "pray") return <Icon name="heart-hand" size={24} color={color} maxScale={1} />;
  if (name === "search") {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
        <Circle cx={11} cy={11} r={6.5} />
        <Path d="m16 16 4.5 4.5" />
      </Svg>
    );
  }
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      {name === "today" ? (
        <>
          <Circle cx={12} cy={13} r={4} />
          <Path d="M12 4v2M4.9 7.9l1.4 1.4M19.1 7.9l-1.4 1.4M3 19h18" />
        </>
      ) : (
        <Path d="M12 6c-2-1.4-5-2-8-1.6v13c3-.4 6 .2 8 1.6 2-1.4 5-2 8-1.6v-13c-3-.4-6 .2-8 1.6zM12 6v13" />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 24, rowGap: 8 },
  row: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  grow: { flex: 1 },
  bar: { flexDirection: "row", padding: 4 },
  tab: { flex: 1, minHeight: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", rowGap: 2 },
  tabAx: { flexDirection: "row", minHeight: 72, columnGap: 6, paddingHorizontal: 16 },
  search: { width: 62, height: 62, alignItems: "center", justifyContent: "center" },
  searchAx: { width: 80, height: 80 },
  // TB-01 `.sbar2`, `.sbi`, `.sbsep`, `.sbh`.
  side: { paddingRight: 12 },
  sideTabs: { rowGap: 2 },
  sideItem: { flexDirection: "row", alignItems: "center", columnGap: 12, minHeight: 44, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  sideRule: { height: StyleSheet.hairlineWidth, marginVertical: 12, marginHorizontal: 8 },
  sideHead: { fontWeight: "600", paddingHorizontal: 14, paddingVertical: 4 },
  // TB-01 `.toptabs`: tabs 44 pt tall, where the canvas's 40 falls under the target size.
  top: { alignItems: "center", paddingBottom: 8, paddingHorizontal: 16, rowGap: 8 },
  topTab: { flexDirection: "row", alignItems: "center", columnGap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999 },
  topPlayer: { width: "100%", maxWidth: 420 },
});

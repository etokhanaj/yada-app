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
import { RADIUS, useLayout, usePalette, useType } from "../design/tokens";
import { GlassButton } from "./Glass";
import { Icon, type IconName } from "./Icon";
import { Chrome, useFontScaleKey } from "./Type";


function LargeTitle({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const t = useType("display");
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
        fontWeight: "600",
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

export function GlassText({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <GlassButton shape="capsule" onPress={onPress} accessibilityLabel={label} testID={testID}>
      <Chrome tone="ink" style={{ fontWeight: "600", paddingHorizontal: 2 }}>
        {label}
      </Chrome>
    </GlassButton>
  );
}

export function PageScreen({
  title,
  back = "Home",
  right,
  children,
  subtitle,
  testID,
  titleNode,
}: {
  title: string;
  /** Drawn in place of the large title: Home's wordmark. `title` still names the page in the bar. */
  titleNode?: ReactNode;
  /** null on Home itself. */
  back?: string | null;
  right?: ReactNode;
  children: ReactNode;
  subtitle?: string;
  testID?: string;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const [barHeight, setBarHeight] = useState(insets.top + 60);
  const [titleBottom, setTitleBottom] = useState(120);
  const [scrolled, setScrolled] = useState(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // The title moves into the bar once the large one has scrolled under it (SO-02).
    setScrolled(e.nativeEvent.contentOffset.y + barHeight > titleBottom);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.paper }} testID={testID}>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingTop: barHeight + 4, paddingHorizontal: gutter, paddingBottom: insets.bottom + 48 }}
        keyboardDismissMode="on-drag"
      >
        <View onLayout={(e) => setTitleBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          {titleNode ?? <LargeTitle>{title}</LargeTitle>}
          {subtitle !== undefined ? (
            <Chrome step="note" tone="muted" style={{ marginTop: 4 }}>
              {subtitle}
            </Chrome>
          ) : null}
        </View>
        <View style={{ marginTop: 18 }}>{children}</View>
      </ScrollView>

      <View pointerEvents="box-none" style={styles.bar} onLayout={(e) => setBarHeight(e.nativeEvent.layout.height - 22)}>
        <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 12, paddingBottom: 6, backgroundColor: palette.paper }}>
          <View style={styles.row}>
            {back !== null ? (
              <GlassButton
                shape="capsule"
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                accessibilityLabel={back}
                testID="page-back"
              >
                <Icon name="back" size={18} tone="muted" />
                <Chrome tone="ink" size={16} style={{ fontWeight: "500", marginRight: 2 }}>
                  {back}
                </Chrome>
              </GlassButton>
            ) : (
              <View />
            )}
            {scrolled ? (
              <Chrome step="sheetTitle" tone="ink" numberOfLines={1} style={styles.inline} accessibilityElementsHidden>
                {title}
              </Chrome>
            ) : null}
            <View style={styles.right}>{right}</View>
          </View>
        </View>
        <View style={{ height: 22, experimental_backgroundImage: `linear-gradient(${palette.paper}, ${transparent(palette.paper)})` }} />
      </View>
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
  done = false,
  label,
  testID,
  chevron = true,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Small muted line above the title: a reference over its verse. */
  overline?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  book?: boolean;
  /** Marked as everything chosen is: the selection wash and bar, title semibold. */
  here?: boolean;
  done?: boolean;
  label?: string;
  testID?: string;
  chevron?: boolean;
  children?: ReactNode;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      unstable_pressDelay={60}
      accessibilityRole={onPress === undefined ? undefined : "button"}
      accessibilityLabel={label}
      accessibilityState={here ? { selected: true } : undefined}
      testID={testID}
      style={({ pressed }) => [
        styles.listRow,
        first || here ? null : { boxShadow: `0 -1px 0 ${palette.divider}` },
        here ? [styles.here, { backgroundColor: palette.selection }] : null,
        pressed && !here ? { backgroundColor: palette.fill } : null,
      ]}
    >
      {here ? <View style={[styles.hereBar, { backgroundColor: palette.accent }]} /> : null}
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
              style={{ fontFamily: "Literata", fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontWeight: here ? "600" : "400" }}
              maxFontSizeMultiplier={2.2}
            >
              {title}
            </Chrome>
          ) : (
            <Chrome tone={done ? "muted" : "ink"} style={{ fontWeight: here ? "600" : "400" }}>
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
    left: 100,
    right: 100,
    textAlign: "center",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    minHeight: 52,
    paddingVertical: 12,
  },
  here: {
    borderRadius: RADIUS.wash,
    marginHorizontal: -12,
    paddingLeft: 22,
    paddingRight: 12,
  },
  hereBar: {
    position: "absolute",
    left: 8,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
});

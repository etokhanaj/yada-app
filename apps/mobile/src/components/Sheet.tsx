/**
 * The frame every sheet shares (canvas J01-03…J01-13): the system's inset
 * sheet and grabber, a pinned header that names what it is and which verse it
 * belongs to (brief §1 rule 3), round `‹` and `×` controls, and a
 * `Back to reading` capsule naming where it returns (rule 4). Fable's
 * dictionary sheet (https://mobbin.com/screens/cc28b946-d3a3-4804-b5b9-c7ec5e07c051):
 * centred title, round close, quiet rows.
 *
 * At accessibility sizes the controls take one row and the title sits beneath
 * it, left-aligned: squeezed between two 64 pt buttons it broke into three
 * lines (v2-review U4).
 */

import * as Haptics from "expo-haptics";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLog } from "../data/AppData";
import { LAYOUT, useLayout, usePalette } from "../design/tokens";
import { Icon } from "./Icon";
import { useSheetNav } from "./navigation";
import { Chrome, Label, Prose } from "./Type";

/** Whether the sheet stands at its large detent: Understand shows more there (amendment 1). */
export interface SheetSizeValue {
  readonly large: boolean;
  readonly headerHeight: number;
}
const SheetSize = createContext<SheetSizeValue>({ large: false, headerHeight: 0 });
export const useSheetSize = () => useContext(SheetSize);

const UNREVIEWED = "A reviewer hasn't checked this explanation yet.";

export function SheetScreen({
  children,
  title,
  subtitle,
  unreviewed = false,
  backLabel,
  verseId,
  backText,
  scrollRef,
  testID,
  onSize,
  closeLabel = "Close",
  returns = false,
  footer = true,
  header,
  leading,
  keyboard = false,
  onScrollY,
}: {
  /**
   * The body's scroll offset and visible height, as it scrolls and when it is laid out:
   * the passage guide counts a passage read when its Next row comes into view (ON-04).
   */
  onScrollY?: (y: number, viewport: number) => void;
  /** A text control where `‹` would be, on a sheet's first screen: Translations' `Choose`. */
  leading?: ReactNode;
  children: ReactNode;
  /** Back to reading. Contents and Search have none: picking is the way out. */
  footer?: boolean;
  /** Replaces the title row: Search puts its field there. */
  header?: ReactNode;
  /** Search: results scroll under a focused field and dismiss the keyboard on drag. */
  keyboard?: boolean;
  /** What `×` returns to, for VoiceOver: "Close" on Understand, "Back to Understand" on evidence. */
  closeLabel?: string;
  /** × is this sheet's way back to reading (no footer): it logs the return, as the capsule did. */
  returns?: boolean;
  /** What this layer is: "1 Corinthians 14:34", "Why we say this", "Word". */
  title: string;
  /** The verse it belongs to, when the title does not already say it. */
  subtitle?: string;
  /** `Unreviewed` under the title, with its one-line popover (brief §2). */
  unreviewed?: boolean;
  /** "1 Corinthians 14:34": where Back to reading returns. */
  backLabel: string | null;
  verseId?: string;
  /** Replaces "Back to reading" when the sheet was opened from somewhere else, e.g. Search. */
  backText?: string;
  scrollRef?: React.Ref<ScrollView>;
  testID?: string;
  /**
   * The detent and header height, for the screen that renders this sheet: useSheetSize only
   * reaches children, and Understand reads both to land a section under the header.
   */
  onSize?: (size: SheetSizeValue) => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { ax, control } = useLayout();
  const { backToReading, closeSheet, back, escape } = useSheetNav();
  const log = useLog();
  const [scrolled, setScrolled] = useState(false);
  const [popover, setPopover] = useState(false);
  const [large, setLarge] = useState(false);
  const [chrome, setChrome] = useState({ header: 90, footer: 74 });
  useEffect(() => onSize?.({ large, headerHeight: chrome.header }), [onSize, large, chrome.header]);
  // A rigid tick when the sheet settles at a new detent (motion note); not on first layout.
  const settled = useRef<boolean | null>(null);
  useEffect(() => {
    if (settled.current !== null && settled.current !== large) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    settled.current = large;
  }, [large]);

  const scrollY = useRef(0);
  const viewport = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrolled(e.nativeEvent.contentOffset.y > 2);
    scrollY.current = e.nativeEvent.contentOffset.y;
    viewport.current = e.nativeEvent.layoutMeasurement.height;
    onScrollY?.(scrollY.current, viewport.current - (footer ? chrome.footer : 0));
  };

  const round = (icon: "back" | "close", label: string, onPress: () => void, id: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={id}
      style={({ pressed }) => [
        styles.round,
        { width: control, height: control, backgroundColor: palette.fill, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name={icon} size={icon === "close" ? 18 : 20} strokeWidth={2.2} />
    </Pressable>
  );

  const titleBlock = (
    <View style={[styles.title, ax ? styles.titleAx : null]}>
      <Chrome step="sheetTitle" tone="ink" accessibilityRole="header" style={{ textAlign: ax ? "left" : "center" }}>
        {title}
      </Chrome>
      {subtitle !== undefined ? (
        <Chrome step="note" tone="muted" style={{ textAlign: ax ? "left" : "center", marginTop: 1 }}>
          {subtitle}
        </Chrome>
      ) : null}
      {unreviewed ? (
        <Pressable
          onPress={() => {
            if (!popover) AccessibilityInfo.announceForAccessibility(UNREVIEWED);
            setPopover((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel="Unreviewed"
          accessibilityHint="Explains what unreviewed means"
          hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
          style={styles.unreviewed}
          testID="unreviewed"
        >
          <Chrome
            step="note"
            tone="muted"
            style={{ fontWeight: "500", textDecorationLine: "underline", textDecorationStyle: "dotted" }}
          >
            Unreviewed
          </Chrome>
        </Pressable>
      ) : null}
    </View>
  );

  const side = <View style={{ width: control }} />;
  // A text control is wider than `‹`; both ends take its width so the title stays centred.
  const slot = (child: ReactNode, end: "flex-start" | "flex-end") =>
    leading === undefined ? child : <View style={{ minWidth: 76, alignItems: end }}>{child}</View>;
  const backButton = slot(leading ?? (back === null ? side : round("back", "Back", back, "sheet-back")), "flex-start");
  // × names its destination to VoiceOver: one layer up, never further (v2-review X7).
  // A sheet without the Back to reading capsule (Understand, canvas SN-09) counts its × as the return.
  const close = () => {
    if (!footer && returns) log("return_to_reading", verseId);
    closeSheet();
  };
  const closeButton = slot(round("close", closeLabel, close, "sheet-close"), "flex-end");

  return (
    <SheetSize.Provider value={{ large, headerHeight: chrome.header }}>
      <View
        style={{ flex: 1, backgroundColor: palette.sheet }}
        onLayout={(e) => setLarge(e.nativeEvent.layout.height > window.height * 0.75)}
        // A sheet is its own screen to VoiceOver, and two-finger Z goes back one depth (rule 6).
        accessibilityViewIsModal
        onAccessibilityEscape={escape}
        testID={testID}
      >
        {/*
          react-native-screens sizes a sheet's ScrollView itself, so its frame
          ignores siblings above it (at AX5 the body started under the header).
          The ScrollView fills the sheet; header and footer overlay it, and
          their measured heights become the content's padding.
        */}
        <ScrollView
          ref={scrollRef}
          style={StyleSheet.absoluteFill}
          contentContainerStyle={[styles.body, { paddingTop: chrome.header + 6, paddingBottom: (footer ? chrome.footer : insets.bottom) + 24 }]}
          keyboardDismissMode={keyboard ? "on-drag" : undefined}
          keyboardShouldPersistTaps={keyboard ? "handled" : undefined}
          scrollIndicatorInsets={{ top: chrome.header, bottom: chrome.footer }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onLayout={(e) => {
            viewport.current = e.nativeEvent.layout.height;
            onScrollY?.(scrollY.current, viewport.current - (footer ? chrome.footer : 0));
          }}
          onContentSizeChange={() => onScrollY?.(scrollY.current, viewport.current - (footer ? chrome.footer : 0))}
        >
          {children}
        </ScrollView>

        <View
          onLayout={(e) => {
            const header = Math.round(e.nativeEvent.layout.height);
            setChrome((c) => (c.header === header ? c : { ...c, header }));
          }}
          style={[styles.header, { backgroundColor: palette.sheet }, scrolled ? { boxShadow: `0 1px 0 ${palette.divider}` } : null]}
        >
          {header !== undefined ? (
            header
          ) : ax ? (
            <>
              <View style={styles.axControls}>
                {backButton}
                {closeButton}
              </View>
              {titleBlock}
            </>
          ) : (
            <View style={styles.row}>
              {backButton}
              {titleBlock}
              {closeButton}
            </View>
          )}
          {popover ? (
            <Pressable onPress={() => setPopover(false)} style={[styles.popover, { backgroundColor: palette.ink }]} accessibilityRole="text">
              <Prose step="note" tone="paper">
                {UNREVIEWED}
              </Prose>
            </Pressable>
          ) : null}
        </View>

        {footer ? (
        <View
          onLayout={(e) => {
            const height = Math.round(e.nativeEvent.layout.height);
            setChrome((c) => (c.footer === height ? c : { ...c, footer: height }));
          }}
          style={[styles.footer, { backgroundColor: palette.sheet, paddingBottom: Math.max(insets.bottom - 20, 14) }]}
        >
          <Pressable
            onPress={() => {
              // "Back to search" closes only this sheet: Search is a sheet too, beneath it.
              if (backText !== undefined) return closeSheet();
              log("return_to_reading", verseId);
              backToReading();
            }}
            accessibilityRole="button"
            accessibilityLabel={backText ?? (backLabel === null ? "Back to reading" : `Back to reading, ${backLabel}`)}
            testID="back-to-reading"
            style={({ pressed }) => [styles.backToReading, { backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 }]}
          >
            {/* Chrome caps at 2×: one line even at AX5 (brief §3). */}
            <Chrome tone="ink" numberOfLines={1} style={{ fontWeight: "600" }}>
              {backText ?? "Back to reading"}
            </Chrome>
          </Pressable>
        </View>
        ) : null}
      </View>
    </SheetSize.Provider>
  );
}

/**
 * Understand's sheets (canvas SN-09) have no Back to reading capsule: × is the one way out, and
 * says where it goes. Spread onto SheetScreen.
 */
export const UNDERSTAND_EXIT = { footer: false, returns: true, closeLabel: "Close, back to reading" } as const;

/** A section: sentence-case label, then its content (canvas `.sec`). */
export function Section({ title, children, first = false, hint }: { title: string; children: ReactNode; first?: boolean; hint?: string }) {
  const { sectionGap } = useLayout();
  return (
    <View style={{ marginTop: first ? 0 : sectionGap }}>
      <Label style={{ marginBottom: 6 }}>{title}</Label>
      {hint !== undefined ? (
        <Prose step="note" tone="muted" style={{ marginBottom: 4 }}>
          {hint}
        </Prose>
      ) : null}
      {children}
    </View>
  );
}

/**
 * A row: the whole row is the target, one quiet separator between neighbours
 * and a trailing chevron (canvas `.row`). Not a card.
 */
export function Row({
  children,
  onPress,
  first = false,
  chevron = true,
  label,
  hint,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  first?: boolean;
  chevron?: boolean;
  label?: string;
  hint?: string;
  testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      unstable_pressDelay={60}
      accessibilityRole={onPress === undefined ? undefined : "button"}
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID={testID}
      style={({ pressed }) => [
        styles.rowItem,
        first ? null : { boxShadow: `0 -1px 0 ${palette.divider}` },
        pressed ? { backgroundColor: palette.fill } : null,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>{children}</View>
      {chevron && onPress !== undefined ? <Icon name="forward" size={18} tone="muted" /> : null}
    </Pressable>
  );
}

/**
 * A row's one muted line (canvas SN-09: name, one muted line, a chevron). Capped at 2× like the
 * row's name: uncapped, the note step reached 40 pt at AX5 and stood larger than the 34 pt name
 * above it (AX5 screenshot, 11 Oct 2026).
 */
export function RowNote({ children }: { children: ReactNode }) {
  return (
    <Chrome step="note" tone="muted" maxFontSizeMultiplier={2}>
      {children}
    </Chrome>
  );
}

/** An accent text link with a 44 pt target: `More`, `Show all 7`, `Compare the 2 readings`. */
export function TextLink({ label, onPress, testID, a11yLabel }: { label: string; onPress: () => void; testID?: string; a11yLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      testID={testID}
      style={({ pressed }) => [styles.textLink, pressed ? { opacity: 0.6 } : null]}
    >
      <Chrome tone="accent" size={15} style={{ fontWeight: "600" }}>
        {label}
      </Chrome>
    </Pressable>
  );
}

/** A capsule link to another verse: evidence chips (canvas `.elink`). */
export function Chip({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      testID={testID}
      style={({ pressed }) => [styles.chip, { backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 }]}
    >
      <Chrome tone="ink" size={14} style={{ fontWeight: "500" }}>
        {label}
      </Chrome>
      <Icon name="forward" size={16} tone="muted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    minHeight: 56,
  },
  axControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  titleAx: {
    flex: 0,
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  unreviewed: {
    minHeight: 24,
    justifyContent: "center",
  },
  round: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  popover: {
    position: "absolute",
    top: "100%",
    alignSelf: "center",
    maxWidth: 300,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  body: {
    paddingHorizontal: 22,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  backToReading: {
    minHeight: LAYOUT.backToReading,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    minHeight: 44,
    paddingVertical: 12,
  },
  textLink: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  chip: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 2,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 999,
  },
});

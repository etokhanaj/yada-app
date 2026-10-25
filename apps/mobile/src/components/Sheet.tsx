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
import { useNavigation, useRoute } from "expo-router";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
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
import { LAYOUT, useLayout, usePalette, WIDE } from "../design/tokens";
import { backPill } from "../lib/backToReading";
import { Icon } from "./Icon";
import { useSheetNav } from "./navigation";
import { Chrome, Prose, SectionTitle } from "./Type";

/** Whether the sheet stands at its large detent: Understand shows more there (amendment 1). */
export interface SheetSizeValue {
  readonly large: boolean;
  readonly headerHeight: number;
  /** The last size change followed the reader's own touch on the sheet, not an open or a jump. */
  readonly byReader: boolean;
}
/**
 * Each sheet page's title, by route key, so ‹ can name the page it returns to. VoiceOver heard "Back" on every
 * page pushed inside a sheet; CLAUDE.md: every exit names its destination (IA stress test, 15 Oct 2026).
 */
const titles = new Map<string, string>();

function useBackName(title: string): string | null {
  const route = useRoute();
  const navigation = useNavigation();
  useEffect(() => {
    titles.set(route.key, title);
    return () => void titles.delete(route.key);
  }, [route.key, title]);
  const state = navigation.getState();
  const index = state?.routes.findIndex((r) => r.key === route.key) ?? -1;
  const previous = index > 0 ? state?.routes[index - 1] : undefined;
  return previous === undefined ? null : (titles.get(previous.key) ?? null);
}

const SheetSize = createContext<SheetSizeValue>({ large: false, headerHeight: 0, byReader: false });

/** How close to the foot, in points, counts as near it: about two screens of rows ahead of the thumb. */
export const NEAR_END = 1200;

/** A size change this soon after a touch on the sheet is taken as the reader's drag. */
const DRAG_WINDOW_MS = 1500;
export const useSheetSize = () => useContext(SheetSize);

export function SheetScreen({
  children,
  title,
  subtitle,
  backLabel,
  verseId,
  backText,
  scrollRef,
  testID,
  onSize,
  closeLabel = "Close",
  returns = false,
  footer: backFooter = true,
  foot,
  header,
  leading,
  noBack = false,
  keyboard = false,
  fit = false,
  titleInBody = false,
  onNearEnd,
}: {
  /** The foot of the body is near: Search draws its next verses then rather than all at once (SE-31, QA 25 Oct 2026). */
  onNearEnd?: () => void;
  /**
   * The body leads with the title itself, large (PM-30: a place's name in Literata): the bar keeps ‹ and × and draws
   * no title, so the name is not said twice. The title still names this page to the next one's ‹.
   */
  titleInBody?: boolean;
  /**
   * The sheet is as tall as what it holds (Build 12; John, 25 Oct 2026: "bottom sheet is quite high"). Its route uses
   * `sheetAllowedDetents: "fitToContents"`; header, body and foot are laid out in turn, with no scroll view to fill,
   * since a filling scroll view inside a sized-to-content sheet collapses it (TestFlight build 9).
   */
  fit?: boolean;
  /** A text control where `‹` would be, on a sheet's first screen: Translations' `Choose`. */
  leading?: ReactNode;
  /** A root sheet over a full-screen view (Voice over the player) has no screen of its own behind it: × only. */
  noBack?: boolean;
  children: ReactNode;
  /** Back to reading. Contents and Search have none: picking is the way out. */
  footer?: boolean;
  /** Pinned at the foot in place of Back to reading: Compare's "Add or remove" (CP-01). */
  foot?: ReactNode;
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
  const footer = backFooter || foot !== undefined;
  const { ax, control, regular } = useLayout();
  const { backToReading, closeSheet, back, escape } = useSheetNav();
  const backName = useBackName(title);
  const log = useLog();
  const [scrolled, setScrolled] = useState(false);
  const [large, setLarge] = useState(false);
  const [chrome, setChrome] = useState({ header: 90, footer: 74 });
  const touchedAt = useRef(0);
  const [byReader, setByReader] = useState(false);
  useEffect(() => onSize?.({ large, headerHeight: chrome.header, byReader }), [onSize, large, chrome.header, byReader]);
  // A rigid tick when the reader drags the sheet to a new detent (motion note). Review §4: it fired
  // when a sheet opened large (Contents, Search, every sheet at AX sizes), so only after a touch.
  const settled = useRef<boolean | null>(null);
  useEffect(() => {
    const dragged = Date.now() - touchedAt.current < DRAG_WINDOW_MS;
    if (settled.current !== null && settled.current !== large) {
      setByReader(dragged);
      if (dragged) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    }
    settled.current = large;
  }, [large]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    setScrolled(contentOffset.y > 2);
    if (onNearEnd !== undefined && contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END) onNearEnd();
  };

  const round = (icon: "back" | "close", label: string, onPress: () => void, id: string, named: string | null = null) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={id}
      style={({ pressed }) => [
        styles.round,
        // White circles with a hairline ring (polish-2026-10-15.md, after YouVersion's ×).
        { width: control, height: control, backgroundColor: palette.sheet, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.edge, opacity: pressed ? 0.6 : 1 },
        // DN-06 `.sh-back.named`: a pill, "‹ 14:34", as wide as its words.
        named !== null ? [styles.named, { minWidth: control }] : null,
      ]}
    >
      <Icon name={icon} size={icon === "close" ? 18 : 20} strokeWidth={2.2} />
      {named !== null ? (
        <Chrome tone="ink" numberOfLines={1} maxFontSizeMultiplier={2}>
          {named}
        </Chrome>
      ) : null}
    </Pressable>
  );

  const titleBlock = titleInBody ? (
    ax ? null : <View style={styles.title} />
  ) : (
    <View style={[styles.title, ax ? styles.titleAx : null]}>
      <Chrome step="sheetTitle" tone="ink" accessibilityRole="header" style={{ textAlign: ax ? "left" : "center" }}>
        {title}
      </Chrome>
      {subtitle !== undefined ? (
        <Chrome step="note" tone="muted" style={{ textAlign: ax ? "left" : "center", marginTop: 1 }}>
          {subtitle}
        </Chrome>
      ) : null}
    </View>
  );

  const side = <View style={{ width: control }} />;
  // A text control is wider than `‹`; both ends take its width so the title stays centred.
  const slot = (child: ReactNode, end: "flex-start" | "flex-end") =>
    leading === undefined ? child : <View style={{ minWidth: 76, alignItems: end }}>{child}</View>;
  const backButton = slot(leading ?? (back === null || noBack ? side : round("back", backName === null ? "Back" : `Back to ${backName}`, back, "sheet-back", backPill(backName))), "flex-start");
  // × names its destination to VoiceOver: one layer up, never further (v2-review X7).
  // A sheet without the Back to reading capsule (Understand, canvas SN-09) counts its × as the return.
  const close = () => {
    if (!footer && returns) log("return_to_reading", verseId);
    closeSheet();
  };
  const closeButton = slot(round("close", closeLabel, close, "sheet-close"), "flex-end");

  return (
    <SheetSize.Provider value={{ large, headerHeight: chrome.header, byReader }}>
      <View
        style={fit ? { backgroundColor: palette.sheet } : { flex: 1, backgroundColor: palette.sheet }}
        onTouchStart={() => (touchedAt.current = Date.now())}
        onTouchEnd={() => (touchedAt.current = Date.now())}
        // On an iPad the system draws a sheet as a centred form sheet narrower than the window, whole and with no detent
        // to grow to, so it counts as large there: Understand shows all it has (TB-02, until it sits beside the text).
        onLayout={(e) => setLarge(e.nativeEvent.layout.height > window.height * 0.75 || (regular && e.nativeEvent.layout.width < window.width - 1))}
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
        {fit ? null : <ScrollView
          ref={scrollRef}
          style={StyleSheet.absoluteFill}
          contentContainerStyle={[
            styles.body,
            { paddingTop: chrome.header + 6, paddingBottom: (footer ? chrome.footer : insets.bottom) + 24 },
            // Where a sheet is drawn as wide as an open Duo, its body keeps a column rather than running the width.
            regular ? { width: "100%", maxWidth: WIDE.sheet, alignSelf: "center" } : null,
          ]}
          keyboardDismissMode={keyboard ? "on-drag" : undefined}
          keyboardShouldPersistTaps={keyboard ? "handled" : undefined}
          scrollIndicatorInsets={{ top: chrome.header, bottom: chrome.footer }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          {children}
        </ScrollView>}

        <View
          onLayout={(e) => {
            const header = Math.round(e.nativeEvent.layout.height);
            setChrome((c) => (c.header === header ? c : { ...c, header }));
          }}
          style={[styles.header, fit ? styles.inFlow : null, { backgroundColor: palette.sheet }, scrolled ? { boxShadow: `0 1px 0 ${palette.divider}` } : null]}
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
        </View>

        {/* The inset sheet already floats above the home indicator, so no safe-area padding under it (12h QA: 80 pt of empty sheet). */}
        {fit ? <View style={[styles.body, { paddingTop: 6, paddingBottom: 24 }]}>{children}</View> : null}

        {footer ? (
        <View
          onLayout={(e) => {
            const height = Math.round(e.nativeEvent.layout.height);
            setChrome((c) => (c.footer === height ? c : { ...c, footer: height }));
          }}
          style={[styles.footer, fit ? styles.inFlow : null, { backgroundColor: palette.sheet, paddingBottom: Math.max(insets.bottom - 20, 14) }]}
        >
          {foot !== undefined ? foot : (
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
          )}
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

/** A section: its title in bold ink (polish-2026-10-15.md: "the title carries the hierarchy"), then its content. */
export function Section({ title, children, first = false, hint }: { title: string; children: ReactNode; first?: boolean; hint?: string }) {
  const { sectionGap } = useLayout();
  return (
    <View style={{ marginTop: first ? 0 : sectionGap }}>
      <SectionTitle inSheet style={{ marginBottom: 6 }}>{title}</SectionTitle>
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
  trailing,
  selected,
}: {
  children: ReactNode;
  onPress?: () => void;
  first?: boolean;
  chevron?: boolean;
  label?: string;
  hint?: string;
  testID?: string;
  /** At the trailing edge in place of the chevron: Compare's Choose tick (CP-06). */
  trailing?: ReactNode;
  /** A chosen row, said by VoiceOver as selected. */
  selected?: boolean;
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
      accessibilityState={selected === undefined ? undefined : { selected }}
      testID={testID}
      style={({ pressed }) => [
        styles.rowItem,
        first ? null : { boxShadow: `0 -1px 0 ${palette.divider}` },
        pressed ? { backgroundColor: palette.fill } : null,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>{children}</View>
      {trailing ?? (chevron && onPress !== undefined ? <Icon name="forward" size={18} tone="muted" /> : null)}
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

/**
 * A secondary action in a sheet's body (canvas `.tbtn2`): a grey-fill capsule, 44 pt, ink 600 at 15 pt, 18 pt
 * sides. US-08's "Try again", SN-05's, the guide's. TextCapsule, not Capsule: ActionBar exports a Capsule too
 * (the reader bar's pill), and two exports of one name invited the wrong import.
 */
export function TextCapsule({ label, onPress, testID, a11yLabel }: { label: string; onPress: () => void; testID?: string; a11yLabel?: string }) {
  const palette = usePalette();
  const { ax } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      testID={testID}
      style={({ pressed }) => [styles.capsule, { backgroundColor: palette.fill, opacity: pressed ? 0.7 : 1 }]}
    >
      <Chrome tone="ink" size={ax ? undefined : 15} style={{ fontWeight: "600" }}>
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
  round: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  named: {
    width: "auto",
    flexDirection: "row",
    columnGap: 2,
    paddingLeft: 8,
    paddingRight: 14,
  },
  body: {
    paddingHorizontal: 22,
  },
  inFlow: { position: "relative" },
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
  capsule: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
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

/**
 * The frame every layer under the reading surface shares: one scrolling
 * column of paper, and a persistent "‹ Back to reading" naming the exact
 * place the reader left. Everything is reversible (design brief).
 */

import type { ReactNode } from "react";
import { Pressable, ScrollView, type ScrollViewProps, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLog } from "../data/AppData";
import { SPACE, usePalette } from "../design/tokens";
import { useSheetNav } from "./navigation";
import { Chrome, Label } from "./Type";

export function SheetScreen({
  children,
  backLabel,
  verseId,
  scrollRef,
  contentStyle,
  backText,
}: {
  children: ReactNode;
  /** Replaces "Back to reading" when the sheet was opened from somewhere else, e.g. Search. */
  backText?: string;
  /** "1 Corinthians 14:34": where Back to reading returns. */
  backLabel: string | null;
  verseId?: string;
  scrollRef?: React.Ref<ScrollView>;
  contentStyle?: ScrollViewProps["contentContainerStyle"];
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { backToReading } = useSheetNav();
  const log = useLog();

  return (
    // A sheet is its own screen to VoiceOver (design brief, accessibility),
    // back bar included.
    <View style={{ flex: 1, backgroundColor: palette.paper }} accessibilityViewIsModal>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.body, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <Pressable
        onPress={() => {
          if (backText === undefined) log("return_to_reading", verseId);
          backToReading();
        }}
        style={({ pressed }) => [
          styles.backBar,
          {
            borderTopColor: palette.divider,
            backgroundColor: pressed ? palette.selection : palette.paper,
            paddingBottom: Math.max(insets.bottom, SPACE.md),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={backText ?? (backLabel === null ? "Back to reading" : `Back to reading, ${backLabel}`)}
        testID="back-to-reading"
      >
        <Chrome size={16} numberOfLines={2} style={{ textAlign: "center" }}>
          {backText !== undefined ? `‹ ${backText}` : `‹ Back to reading${backLabel === null ? "" : ` — ${backLabel}`}`}
        </Chrome>
      </Pressable>
    </View>
  );
}

/** "Draft · not yet reviewed": quiet, tracked, never hidden (John's decision 2). */
export function DraftLabel() {
  return (
    <Label style={{ marginTop: SPACE.xs }} accessibilityRole="text" testID="draft-label">
      Draft · not yet reviewed
    </Label>
  );
}

export function Hairline({ spacing = SPACE.lg }: { spacing?: number }) {
  const palette = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.divider, marginVertical: spacing }} />;
}

export function Section({ title, children, first = false }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <View style={{ marginTop: first ? 0 : SPACE.xl }}>
      <Label style={{ marginBottom: SPACE.sm }}>{title}</Label>
      {children}
    </View>
  );
}

/** A quiet tappable line: "See occurrences ›". Text, not a button shape. */
export function LinkRow({
  label,
  onPress,
  hint,
  testID,
}: {
  label: string;
  onPress: () => void;
  hint?: string;
  testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityHint={hint}
      testID={testID}
      style={({ pressed }) => [styles.link, pressed ? { backgroundColor: palette.selection } : null]}
    >
      <Chrome size={16}>{label}</Chrome>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: SPACE.lg,
    paddingBottom: SPACE.xxl,
  },
  backBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACE.md,
    paddingHorizontal: SPACE.lg,
    alignItems: "center",
  },
  link: {
    paddingVertical: SPACE.sm,
    marginHorizontal: -SPACE.xs,
    paddingHorizontal: SPACE.xs,
    borderRadius: 5,
  },
});

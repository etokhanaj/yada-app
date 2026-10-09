/**
 * Header for the pushed screens (Search, Bookmarks, Recently explored,
 * Library, Start here): a quiet back chevron and a large serif title, the
 * Apple Books Home convention the handoff chose
 * (https://mobbin.com/screens/fa54930d-72ec-44e1-b65d-f8b50aa6e173).
 */

import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONTS, SPACE, usePalette } from "../design/tokens";
import { Chrome, useFontScaleKey } from "./Type";

export function LargeTitle({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const key = useFontScaleKey();
  return (
    <Text
      key={key}
      accessibilityRole="header"
      style={{ fontFamily: FONTS.scripture, fontSize: 34, lineHeight: 41, letterSpacing: -0.6, color: palette.ink }}
    >
      {children}
    </Text>
  );
}

export function PageHeader({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + SPACE.sm, paddingHorizontal: SPACE.lg }}>
      <View style={styles.bar}>
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="page-back"
          >
            <Chrome size={17}>‹ Back</Chrome>
          </Pressable>
        ) : (
          <View />
        )}
        {right}
      </View>
      <View style={{ marginTop: SPACE.sm, marginBottom: SPACE.md }}>
        <LargeTitle>{title}</LargeTitle>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: SPACE.md,
  },
});

/**
 * Build 12: the raised card, for something a person wrote (a request, a note), white with a soft shadow in light and
 * near-black with a hairline ring in dark. It is the only shadow in Yada (design/system.test.ts): John allowed it on
 * 24 Oct 2026 ("adopt the new ds proposals … even if they change our rules") for things people wrote, while fill cards
 * stay for things to do. Same 24 pt radius as every card, never nested.
 */

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { usePalette } from "../design/tokens";

export function RaisedCard({ children, testID }: { children: ReactNode; testID?: string }) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.raised, boxShadow: palette.raisedShadow }]} testID={testID}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, marginBottom: 10 },
});

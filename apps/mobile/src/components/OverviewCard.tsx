/**
 * OR-03, OR-06: one card per BibleProject overview, opening their page in a sheet over About (expo-web-browser, the
 * system's own Safari sheet). With no connection the card stays, quieter, and says why; it never shows an error and
 * never downloads. A card because it is one self-contained thing you tap (CLAUDE.md: 24 pt radius, soft fill, no
 * shadow).
 */

import { useNetworkState } from "expo-network";
import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, View } from "react-native";

import { usePalette } from "../design/tokens";
import { minutes, type Overview } from "../lib/overviews";
import { Chrome } from "./Type";

export function OverviewCard({ overview, part, book }: { overview: Overview; part: string | null; book: string }) {
  const palette = usePalette();
  // Subscribed, not polled (CLAUDE.md): iOS says when the connection changes. Unknown counts as online.
  const offline = useNetworkState().isConnected === false;
  const length = minutes(overview.seconds);
  const title = part === null ? "Watch the BibleProject overview" : `Watch the BibleProject overview, ${part}`;
  return (
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(overview.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })}
      disabled={offline}
      accessibilityRole="link"
      accessibilityState={{ disabled: offline }}
      accessibilityLabel={`${title} of ${book}, ${length}.${offline ? " Needs a connection" : " Opens bibleproject.com"}`}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? palette.fill : palette.card, opacity: offline ? 0.6 : 1 }]}
      testID="about-overview"
    >
      <View style={styles.row}>
        <Chrome tone="ink" style={{ flex: 1, fontWeight: "600" }}>
          {title}
        </Chrome>
        <Chrome step="note" tone="muted" style={styles.length}>
          {length}
        </Chrome>
      </View>
      {offline ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 4 }}>
          Needs a connection
        </Chrome>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20, minHeight: 44 },
  row: { flexDirection: "row", alignItems: "baseline", columnGap: 12 },
  length: { fontVariant: ["tabular-nums"] },
});

/**
 * IA v4 (canvas IA-15–17; John chose tabs, 15 Oct 2026): two tabs, Today and Bible, as iOS 26's native tab bar.
 * A tab only for a daily job (docs/build-7-ia-stress-test.md). The reader and every sheet stay in the root stack,
 * so they open over the tabs and cover them (IA-16). Search stays in Bible's header for build 7a: its screen is a
 * sheet, and a search tab is a separate piece of work (lean plan §0).
 */

import { NativeTabs } from "expo-router/unstable-native-tabs";

import { usePalette } from "../../design/tokens";

export default function TabsLayout() {
  const palette = usePalette();
  return (
    // No minimizeBehavior: on scroll the bar shrank to a bare icon with no glass, over the text
    // (simulator, 15 Oct 2026).
    <NativeTabs tintColor={palette.accent}>
      {/* Today pads itself (insets.top, and 120 below for the bar): the automatic inset doubled the top gap and kept
          the picture from running under the status bar (simulator, 16 Oct 2026). */}
      <NativeTabs.Trigger name="today" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sun.horizon", selected: "sun.horizon.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Bible</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "book", selected: "book.fill" }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

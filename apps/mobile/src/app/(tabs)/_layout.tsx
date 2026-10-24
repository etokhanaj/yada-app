/**
 * IA v4 (canvas IA-15–17; John chose tabs, 15 Oct 2026): Today, Bible and Pray (PT-46, John 24 Oct 2026: "make pray its
 * own tab"), with Search as the round button beside them
 * (IA-15) and, while listening, the mini player riding above (IA-17). A tab only for a daily job
 * (docs/build-7-ia-stress-test.md). The reader and every sheet stay in the root stack, so they open over the tabs and
 * cover them (IA-16). The bar is our own (components/TabBar.tsx): the native one took no taps (18 Oct 2026).
 *
 * Yada opens on the tab last used; the very first launch opens Bible, where Start here is (DR-01, canvas note i7).
 */

import { Tabs } from "expo-router/js-tabs";

import { TabBar } from "../../components/TabBar";
import { useAppData } from "../../data/AppData";
import { saveSetting } from "../../data/user";
import { useLayout } from "../../design/tokens";

export const unstable_settings = { initialRouteName: "index" };

export default function TabsLayout() {
  // Read before the tabs mounted (app/_layout.tsx start), so nothing routes after a link or Return already has.
  const { user, launchTab } = useAppData();
  const remember = (tab: "today" | "index" | "pray") => ({ focus: () => void saveSetting(user, "lastTab", tab).catch(() => undefined) });
  // TB-01, DU-01: in a regular-width window the tabs take their own room, a sidebar at the left or a capsule at the
  // top, and the page lays out beside or under them; on the iPhone the bar floats over the page's foot.
  const { tabs } = useLayout();
  const tabBarPosition = tabs === "side" ? "left" : tabs;
  return (
    <Tabs initialRouteName={launchTab} tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, tabBarPosition }}>
      <Tabs.Screen name="today" listeners={remember("today")} />
      <Tabs.Screen name="index" listeners={remember("index")} />
      <Tabs.Screen name="pray" listeners={remember("pray")} />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}

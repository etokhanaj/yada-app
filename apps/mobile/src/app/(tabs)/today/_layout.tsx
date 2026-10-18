/**
 * Today's own stack, inside the tab: Pray and its lists push here so they keep the tab bar, as the canvas draws them
 * (PR-07, CI-01, CI-02, PR-11; note refs_pr: "Pray and its lists keep the tab bar … praying, asking and Sit with this
 * cover it"). Praying (pray/someone), asking (pray/ask), the iCloud sheet and Sit with this stay in the root stack, so
 * they still cover the tabs. They were all root routes until build 10, and covered the bar (design QA, 18 Oct 2026).
 * A tap on Today's tab while Pray is open returns to Today (the stack pops to its top on tabPress).
 */

import { Stack } from "expo-router";

import { usePalette } from "../../../design/tokens";
import { useReduceMotion } from "../../../lib/motion";

export const unstable_settings = { initialRouteName: "index" };

export default function TodayStack() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper }, animation: reduceMotion ? "fade" : "default" }} />;
}

/**
 * Today's own stack, inside the tab. Pray and its lists were pushed here until Pray became a tab of its own (PT-46,
 * 24 Oct 2026); they now live in (tabs)/pray with the same stack. A tap on Today's tab returns to Today's top.
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

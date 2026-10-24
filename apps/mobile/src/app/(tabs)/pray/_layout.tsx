/**
 * Pray's own stack, inside its tab (PT-46): Your list, a circle, its people, Everyone on Yada and Bible prayers push here
 * and keep the tab bar. Praying (pray/someone, pray/through, prayer, silence), asking and Add or ask stay in the root
 * stack, so they cover the tabs (refs_pr: "praying, asking and Sit with this cover it").
 */

import { Stack } from "expo-router";

import { usePalette } from "../../../design/tokens";
import { useReduceMotion } from "../../../lib/motion";

export const unstable_settings = { initialRouteName: "index" };

export default function PrayStack() {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper }, animation: reduceMotion ? "fade" : "default" }} />;
}

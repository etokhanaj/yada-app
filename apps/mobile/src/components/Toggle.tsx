/**
 * A switch in Yada's accent (forest; chartreuse in dark), not iOS green (docs/colour-rules.md: switches use `accent`,
 * 3:1 against the ground). Every switch in the app is this one.
 */

import { Switch, type SwitchProps } from "react-native";

import { usePalette } from "../design/tokens";

export function Toggle(props: SwitchProps) {
  const palette = usePalette();
  return <Switch trackColor={{ true: palette.accent }} {...props} />;
}

/**
 * Sign in to iCloud (CI-03, as XT-05): a circle needs every member's iCloud identity, so without one it says why in a
 * line and opens Settings.
 */

import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { PageScreen } from "../../components/Page";
import { Chrome, Prose } from "../../components/Type";
import { usePalette } from "../../design/tokens";

export default function NeedsICloud() {
  const palette = usePalette();
  const button = (title: string, onPress: () => void, primary: boolean, testID: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.button, { backgroundColor: primary ? palette.ink : palette.card }]} testID={testID}>
      <Chrome style={{ fontWeight: "600", color: primary ? palette.paper : palette.ink }}>{title}</Chrome>
    </Pressable>
  );
  return (
    <PageScreen title="Sign in to iCloud" back="Pray" testID="circle-icloud">
      <Prose step="claim">A circle uses iCloud, so only the people in it can see its requests.</Prose>
      <View style={{ rowGap: 10, marginTop: 20 }}>
        {button("Open Settings", () => void Linking.openSettings(), true, "circle-settings")}
        {button("Not now", () => router.back(), false, "circle-not-now")}
      </View>
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 24, borderRadius: 25, alignItems: "center", justifyContent: "center" },
});

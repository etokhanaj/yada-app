/**
 * Sign in to iCloud (CI-03, as XT-05): a circle needs every member's iCloud identity, so without one it says why in a
 * line and opens Settings. A sheet, so it is drawn as one: a full page inside a form sheet collapsed to nothing but its
 * back pill in TestFlight build 9 (John, 18 Oct 2026).
 */

import { router } from "expo-router";
import { Linking, View } from "react-native";

import { Pill } from "../../components/Pill";
import { SheetScreen } from "../../components/Sheet";
import { Prose } from "../../components/Type";

export default function NeedsICloud() {
  return (
    <SheetScreen title="Sign in to iCloud" backLabel={null} noBack footer={false} testID="circle-icloud">
      <Prose step="claim">A circle uses iCloud, so only the people in it can see its requests.</Prose>
      <View style={{ rowGap: 10, marginTop: 20 }}>
        <Pill title="Open Settings" onPress={() => void Linking.openSettings()} primary testID="circle-settings" />
        <Pill title="Not now" onPress={() => router.back()} testID="circle-not-now" />
      </View>
    </SheetScreen>
  );
}

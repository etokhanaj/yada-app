/**
 * Sign in to iCloud (CI-03, as XT-05): a circle and Ask someone (AO-02) need iCloud identities, so without one it says why in a
 * line and opens Settings. A sheet, so it is drawn as one: a full page inside a form sheet collapsed to nothing but its
 * back pill in TestFlight build 9 (John, 18 Oct 2026).
 */

import { router } from "expo-router";
import { Linking, View } from "react-native";

import { Pill } from "../../components/Pill";
import { useLayout } from "../../design/tokens";
import { SheetScreen } from "../../components/Sheet";
import { Prose } from "../../components/Type";

export default function NeedsICloud() {
  const fitSheet = !useLayout().ax;
  return (
    <SheetScreen fit={fitSheet} title="Sign in to iCloud" backLabel={null} noBack footer={false} testID="circle-icloud">
      <Prose step="claim">Circles and asking someone use iCloud, so only the people you choose see what you ask.</Prose>
      <View style={{ rowGap: 10, marginTop: 20 }}>
        <Pill title="Open Settings" onPress={() => void Linking.openSettings()} primary testID="circle-settings" />
        <Pill title="Not now" onPress={() => router.back()} testID="circle-not-now" />
      </View>
    </SheetScreen>
  );
}

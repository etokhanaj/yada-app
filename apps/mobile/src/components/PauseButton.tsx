/**
 * The round Pause on a picture (SW-05 Sit's session, SL-30 Silence): 72 pt glass, two bars, or play when paused. Two
 * bars, as the canvas draws pause: Untitled UI's only pause sits in a circle, which doubled this one.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { ON_PICTURE } from "../design/palette";
import { Icon } from "./Icon";

export function PauseButton({ paused, onPress, testID }: { paused: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={paused ? "Resume" : "Pause"}
      style={({ pressed }) => [styles.pause, { backgroundColor: pressed ? ON_PICTURE.glassSolid : ON_PICTURE.glass }]}
      testID={testID}
    >
      {paused ? (
        <Icon name="play" size={28} tone="white" filled />
      ) : (
        <View style={styles.bars}>
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: "row", columnGap: 7 },
  bar: { width: 4, height: 22, borderRadius: 2, backgroundColor: ON_PICTURE.text },
  pause: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
});

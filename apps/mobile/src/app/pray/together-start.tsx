/**
 * Before the first Pray together (Build 12 PC-32, approved by John 25 Oct 2026; PC-15 before it): the circle's
 * picture, what it is in one line, and Start in FaceTime, as Insight Timer's group session opens
 * (mobbin.com/screens/44cc0fc1-3a63-4158-a5e6-08779a6d821c). It replaces three facts with icons. Shown once per
 * person; after that Pray together starts at once.
 */

import { router, useLocalSearchParams } from "expo-router";
import { InteractionManager, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "../../components/Glass";
import { Icon } from "../../components/Icon";
import { PictureGround } from "../../components/PictureGround";
import { Pill } from "../../components/Pill";
import { Chrome } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { startTogether, TOGETHER_SEEN } from "../../data/together";
import { saveSetting } from "../../data/user";
import { ON_PICTURE } from "../../design/palette";
import { FONTS, useLayout } from "../../design/tokens";
import { circlePicture } from "../../lib/pray";

export default function TogetherStart() {
  const { id = "", name = "Circle", picture } = useLocalSearchParams<{ id?: string; owner?: string; name?: string; picture?: string }>();
  const { user } = useAppData();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();

  // This screen closes first: FaceTime's picker is presented over whatever is on top, and closing this after took the
  // picker down with it (code review, 18 Oct 2026).
  const start = async () => {
    await saveSetting(user, TOGETHER_SEEN, "1").catch(() => undefined);
    router.back();
    InteractionManager.runAfterInteractions(() => startTogether(id, name));
  };

  return (
    <View style={styles.root} testID="together-start">
      <PictureGround day={Number(picture) || circlePicture({ id })} />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: gutter - 8 }}>
        <GlassButton onPicture onPress={() => router.back()} accessibilityLabel="Not now" testID="together-start-close">
          <Icon name="close" size={20} tone="white" />
        </GlassButton>
      </View>
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <Chrome accessibilityRole="header" style={{ color: ON_PICTURE.text, fontFamily: FONTS.scripture, fontWeight: "400" }} size={34}>
          Pray together
        </Chrome>
        <Chrome style={{ color: ON_PICTURE.strong, lineHeight: 24 }}>{`${name} on a FaceTime call, with what to pray on everyone’s screen. Nothing is recorded.`}</Chrome>
      </View>
      <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 16 }}>
        <Pill title="Start in FaceTime" onPicture stretch onPress={() => void start()} testID="together-start-go" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, justifyContent: "flex-end", rowGap: 12, paddingBottom: 20 },
});

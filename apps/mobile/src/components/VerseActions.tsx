/**
 * Build 12: what you can do with a verse, each an icon over its label in one row, as under YouVersion's Verse of the
 * Day (TD-30: Sit, Listen, Share, More). On a picture the glyphs and words are white. It replaces Today's single
 * "Sit with this" capsule, which hid that the verse could also be heard or shared. Each action is a 44 pt target.
 */

import { MenuView } from "@react-native-menu/menu";
import { Pressable, StyleSheet, View } from "react-native";

import { ON_PICTURE } from "../design/palette";
import { useLayout } from "../design/tokens";
import { Icon, type IconName } from "./Icon";
import { Chrome } from "./Type";

export interface VerseAction {
  readonly icon: IconName;
  readonly title: string;
  /** For VoiceOver, when the title alone doesn't say what it acts on ("Sit with John 2:4"). */
  readonly label?: string;
  readonly onPress: () => void;
  readonly testID?: string;
}

/** More: the rest, as a native menu (TD-30: Copy, Open in Bible, About this picture). */
export interface MoreMenu {
  readonly actions: ReadonlyArray<{ id: string; title: string }>;
  readonly onChoose: (id: string) => void;
}

export function VerseActions({ actions, more, onPicture = false }: { actions: readonly VerseAction[]; more?: MoreMenu; onPicture?: boolean }) {
  const { ax } = useLayout();
  const tint = onPicture ? { color: ON_PICTURE.text } : {};
  return (
    <View style={[styles.row, ax ? styles.rowAx : null]}>
      {actions.map((a) => (
        <Pressable
          key={a.title}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={a.label ?? a.title}
          style={({ pressed }) => [styles.action, ax ? styles.actionAx : null, { opacity: pressed ? 0.6 : 1 }]}
          testID={a.testID}
        >
          <Icon name={a.icon} size={22} {...tint} />
          <Chrome step="note" tone="ink" style={[{ fontWeight: "600" }, tint]}>
            {a.title}
          </Chrome>
        </Pressable>
      ))}
      {more === undefined ? null : (
        <MenuView style={ax ? styles.actionAx : null} shouldOpenOnLongPress={false} actions={[...more.actions]} onPressAction={({ nativeEvent }) => more.onChoose(nativeEvent.event)}>
          <View style={styles.action} accessible accessibilityRole="button" accessibilityLabel="More" testID="verse-more">
            <Icon name="more" size={22} {...tint} />
            <Chrome step="note" tone="ink" style={[{ fontWeight: "600" }, tint]}>
              More
            </Chrome>
          </View>
        </MenuView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowAx: { flexWrap: "wrap", rowGap: 12 },
  // Two by two at AX sizes: four in a row wrapped and left More alone on a line (12d QA).
  actionAx: { width: "50%" },
  action: { minWidth: 64, minHeight: 44, alignItems: "center", rowGap: 6, paddingVertical: 4 },
});

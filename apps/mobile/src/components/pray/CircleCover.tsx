/**
 * A circle on Pray (Build 12 PR-51): a few of the circle's people as an avatar stack beside its name. Build 12 (PC-30)
 * gave each circle a picture of its own (lib/pray circlePicture), which replaced the tone from its id.
 */

import { View } from "react-native";

import type { CircleMember } from "../../../modules/yada-pray";
import { useLayout } from "../../design/tokens";
import { Avatar } from "./Avatar";

/** Up to three of a circle's people in a 56 pt square, as the frame draws them (PR-51); decorative, the row says who. */
export function AvatarStack({ members }: { members: readonly CircleMember[] }) {
  const { ax } = useLayout();
  const box = ax ? 64 : 56;
  const size = Math.round(box * 0.6);
  const spots = [
    { left: 0, top: 0 },
    { right: 0, top: Math.round(box * 0.1) },
    { left: Math.round(box * 0.18), bottom: 0 },
  ];
  return (
    <View style={{ width: box, height: box }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {members.slice(0, 3).map((m, i) => (
        <View key={m.id} style={{ position: "absolute", ...spots[i] }}>
          <Avatar id={m.id} name={m.name} size={size} />
        </View>
      ))}
    </View>
  );
}

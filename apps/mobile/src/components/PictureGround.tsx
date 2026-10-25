/**
 * The day's picture as a full-screen ground with its scrim (Build 12: Sit's setup on the picture, its session on the
 * picture blurred to colour). With no picture the brand night stands in (RT-08: "the deep forest, never blank").
 */

import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { pictureFor } from "../data/pictures";
import { BRAND, SCRIM } from "../design/palette";
import { type Part, partOf } from "../lib/today";
import { FillPicture } from "./FillPicture";

/**
 * `part` fixes the picture to the morning's or the evening's (PF-30 prays on the evening picture); `day` to a fixed day
 * picture, as a circle keeps its own (PC-31).
 */
export function PictureGround({ blurred = false, part, day }: { blurred?: boolean; part?: Part; day?: number }) {
  const now = new Date();
  const picture = pictureFor(day ?? now, part ?? (day === undefined ? partOf(now) : "morning"));
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: BRAND.night, overflow: "hidden" }]} pointerEvents="none">
      <StatusBar style="light" />
      {picture === undefined ? null : <FillPicture source={picture.image} blur={blurred ? 40 : undefined} />}
      <View style={[StyleSheet.absoluteFill, blurred ? { backgroundColor: SCRIM.deep } : { experimental_backgroundImage: SCRIM.setup }]} />
    </View>
  );
}

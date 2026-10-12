/**
 * Play, pause, previous verse, next verse. Untitled UI has no plain pause or skip glyphs, so these
 * are the canvas's own shapes (build_canvas.py ICONS "play", "pause", "prevv", "nextv"), on the
 * same 24-unit grid as Icon.tsx and sized the same way.
 */

import { useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

import { usePalette } from "../../design/tokens";

export type MediaIconName = "play" | "pause" | "previous" | "next";

export function MediaIcon({ name, size = 20, tone = "ink", maxScale = 2 }: { name: MediaIconName; size?: number; tone?: "ink" | "paper"; maxScale?: number }) {
  const palette = usePalette();
  const { fontScale } = useWindowDimensions();
  const px = Math.round(size * Math.min(Math.max(fontScale, 1), maxScale));
  const color = tone === "paper" ? palette.paper : palette.ink;
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24" fill="none" accessible={false} importantForAccessibility="no-hide-descendants">
      {name === "play" ? <Path d="M8 5.5v13l10.5-6.5z" fill={color} {...stroke} /> : null}
      {name === "pause" ? <Path d="M8 5v14M16 5v14" {...stroke} strokeWidth={3.2} /> : null}
      {name === "previous" ? (
        <>
          <Path d="M6 5v14" {...stroke} />
          <Path d="M18.5 5.5v13L9 12z" fill={color} {...stroke} />
        </>
      ) : null}
      {name === "next" ? (
        <>
          <Path d="M18 5v14" {...stroke} />
          <Path d="M5.5 5.5v13L15 12z" fill={color} {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}

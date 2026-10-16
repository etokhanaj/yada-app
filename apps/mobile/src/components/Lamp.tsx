/**
 * The streak's lamp (build 7 plan §2 row 8: "a lamp, not a flame"; XT-02): outlined until today counts, then lit.
 * Ours, not an icon set's: no SF Symbol is an oil lamp, and Untitled UI has none (plan §3, "Lamp icon").
 * Never the only signal: the number beside it is text (a11y-build-7).
 */

import Svg, { Path } from "react-native-svg";

const BOWL = "M2.5 13.5h13.2l4.6-2.6c.5-.3 1 .3.7.7l-2.6 3.4A5.5 5.5 0 0 1 14 18H8.2a5.7 5.7 0 0 1-5.7-4.5z";
const FOOT = "M8 20.5h6";
const FLAME = "M9.6 10.8c-1.6-.9-1.9-2.9-.3-5.3.9 1.3 2.2 1.8 2.2 3.4 0 1.4-.9 2.3-1.9 1.9z";

export function Lamp({ lit, color, size = 20 }: { lit: boolean; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d={BOWL} stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill={lit ? color : "none"} />
      <Path d={FOOT} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      {lit ? <Path d={FLAME} fill={color} /> : null}
    </Svg>
  );
}

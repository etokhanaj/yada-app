/**
 * A circle's twelve places (PC-05, PC-14, PC-18): its people, then open places, so "up to 12" is seen, not said
 * (KOHO's slots for people still to invite, mobbin.com/screens/be7a8de5-5392-49da-9dac-193e94e784e6). One row; at AX
 * sizes it wraps. And the ring (PC-02, PC-07, PC-24): the same twelve round a circle.
 */

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle as SvgCircle } from "react-native-svg";

import type { CircleMember } from "../../../modules/yada-pray";
import { AVATAR_SLOT } from "../../design/palette";
import { useLayout } from "../../design/tokens";
import { CIRCLE_MAX } from "../../lib/pray";
import { Avatar } from "./Avatar";

export function Places({ members, onDark = true }: { members: readonly CircleMember[]; onDark?: boolean }) {
  const { ax } = useLayout();
  const size = ax ? 44 : 24;
  const open = Math.max(0, CIRCLE_MAX - members.length);
  return (
    <View style={[styles.row, { flexWrap: ax ? "wrap" : "nowrap", gap: ax ? 8 : 5 }]} accessible accessibilityLabel={`${members.length} of ${CIRCLE_MAX} places taken`}>
      {members.map((m) => (
        <Avatar key={m.id} id={m.id} name={m.name} size={size} onDark={onDark} />
      ))}
      {Array.from({ length: open }, (_, i) => (
        <Avatar key={`open-${i}`} id="" name="" size={size} onDark={onDark} open />
      ))}
    </View>
  );
}

/** Twelve places round a circle; `highlight` is the person who matters here (who invited you). */
export function Ring({ members, size = 230, highlight, onDark = true, children }: { members: readonly CircleMember[]; size?: number; highlight?: string; onDark?: boolean; children?: ReactNode }) {
  const r = size * 0.37;
  const slot = Math.round(size * 0.16);
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / CIRCLE_MAX;
    return { left: size / 2 + r * Math.cos(a) - slot / 2, top: size / 2 + r * Math.sin(a) - slot / 2 };
  };
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${members.length} of ${CIRCLE_MAX} places taken`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {Array.from({ length: CIRCLE_MAX }, (_, i) => i)
          .filter((i) => i >= members.length)
          .map((i) => {
            const p = at(i);
            return <SvgCircle key={i} cx={p.left + slot / 2} cy={p.top + slot / 2} r={slot / 2 - 1} fill="none" stroke={onDark ? AVATAR_SLOT.onDark : AVATAR_SLOT.onLight} strokeWidth={1.5} strokeDasharray="3 4" />;
          })}
      </Svg>
      {members.slice(0, CIRCLE_MAX).map((m, i) => (
        <View key={m.id} style={[styles.abs, at(i)]}>
          <Avatar id={m.id} name={m.name} size={slot} onDark={onDark} ring={m.id === highlight} />
        </View>
      ))}
      {children !== undefined ? <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  abs: { position: "absolute" },
  centre: { alignItems: "center", justifyContent: "center" },
});

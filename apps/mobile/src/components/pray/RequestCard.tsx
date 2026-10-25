/**
 * A request you asked, as a raised card (PR-51; Build 12): something you wrote, so a white card with a soft shadow.
 * Where you asked and when, the request in Literata, how many prayed (only you see it, as PR-11), and Answered. Pray
 * starts something and is a filled pill elsewhere; Mark answered only changes the request's state, so it is a quiet
 * text button with a tick. An answered card carries a lime "Answered" badge and its words in muted ink.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PrayerRequest } from "../../../modules/yada-pray";
import { BRAND } from "../../design/palette";
import { FONTS, usePalette } from "../../design/tokens";
import { askedLine, mineLine } from "../../lib/pray";
import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { RaisedCard } from "../RaisedCard";
import { Chrome } from "../Type";

export function RequestCard({
  request,
  now,
  onAnswered,
  onMore,
  to,
}: {
  request: Pick<PrayerRequest, "id" | "text" | "createdAt" | "answeredAt" | "expiresAt" | "prayed">;
  /** Asked of one person (AO-01): their name; else it was asked of everyone on Yada. */
  to?: string;
  now: number;
  onAnswered: () => void;
  /** Renew and Delete, where the card has them (Your requests). */
  onMore?: () => void;
}) {
  const palette = usePalette();
  const answered = request.answeredAt !== undefined;
  const asked = askedLine("", request.createdAt, now);
  const line = mineLine(request, now);
  return (
    <RaisedCard testID={`request-${request.id}`}>
      <View style={styles.head}>
        <View style={[styles.where, { backgroundColor: to === undefined ? BRAND.forest : palette.tints.sky }]}>
          <Icon name={to === undefined ? "globe" : "person"} size={16} tone={to === undefined ? "white" : "ink"} />
        </View>
        <Chrome step="note" tone="muted" style={{ fontWeight: "600", flex: 1 }}>
          {`You asked ${to ?? "everyone"}${asked === null ? "" : ` · ${asked.toLowerCase()}`}`}
        </Chrome>
        {onMore === undefined ? null : (
          <Pressable onPress={onMore} accessibilityRole="button" accessibilityLabel={`Options for ${request.text}`} style={styles.more} testID={`request-more-${request.id}`}>
            <Icon name="more" size={20} tone="muted" />
          </Pressable>
        )}
      </View>
      <Text style={[styles.text, { color: answered ? palette.mutedInk : palette.ink }]} maxFontSizeMultiplier={2}>
        {request.text}
      </Text>
      <View style={styles.foot}>
        {answered ? <Badge text="Answered" icon="check" /> : null}
        <Chrome step="note" tone="muted" style={{ flexShrink: 1 }}>
          {line}
        </Chrome>
        {answered ? null : (
          <Pressable onPress={onAnswered} accessibilityRole="button" accessibilityLabel={`Mark answered: ${request.text}`} hitSlop={6} style={styles.answer} testID={`request-answered-${request.id}`}>
            <Icon name="check" size={16} tone="accent" />
            <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
              Mark answered
            </Chrome>
          </Pressable>
        )}
      </View>
    </RaisedCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", columnGap: 10 },
  where: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  more: { width: 44, height: 44, marginVertical: -6, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: FONTS.scripture, fontSize: 21, lineHeight: 28, marginTop: 10, marginBottom: 8 },
  foot: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
  answer: { flexDirection: "row", alignItems: "center", columnGap: 4, minHeight: 44 },
});

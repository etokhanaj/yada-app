/**
 * Your requests (PR-11, XT-04): Live and Answered, each request in Literata with how many prayed (only you see it, never
 * "0") and how long it has left or when it was answered; ⋯ beside each for Mark answered, Renew and Delete. It was one
 * flat list of rows (design QA, 18 Oct 2026).
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Pressable, StyleSheet, Text, View } from "react-native";

import { type PrayerRequest, prayCloud } from "../../../../../modules/yada-pray";
import { Icon } from "../../../../components/Icon";
import { PageScreen } from "../../../../components/Page";
import { Chrome, SectionTitle } from "../../../../components/Type";
import { FONTS, useLayout, usePalette } from "../../../../design/tokens";
import { mineLine } from "../../../../lib/pray";

export default function Mine() {
  const palette = usePalette();
  const { sectionGap } = useLayout();
  const [mine, setMine] = useState<PrayerRequest[] | null>(null);
  const reload = useCallback(() => void prayCloud?.mine().then(setMine).catch(() => setMine([])), []);
  useFocusEffect(reload);

  const act = (r: PrayerRequest) => {
    const choices: [string, (() => Promise<void>) | undefined][] =
      r.answeredAt === undefined
        ? [["Mark answered", prayCloud?.markAnswered.bind(null, r.id)], ["Renew for 7 days", prayCloud?.renew.bind(null, r.id)], ["Delete", prayCloud?.remove.bind(null, r.id)]]
        : [["Delete", prayCloud?.remove.bind(null, r.id)]];
    ActionSheetIOS.showActionSheetWithOptions({ options: [...choices.map(([t]) => t), "Cancel"], destructiveButtonIndex: choices.length - 1, cancelButtonIndex: choices.length }, (i) => {
      // A failed change in iCloud said nothing (code review, 18 Oct 2026).
      void choices[i]?.[1]?.()
        .then(reload)
        .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t change that request. Try again."));
    });
  };

  const now = Date.now();
  const live = (mine ?? []).filter((r) => r.answeredAt === undefined);
  const answered = (mine ?? []).filter((r) => r.answeredAt !== undefined);
  const group = (title: string, list: PrayerRequest[], first: boolean) =>
    list.length === 0 ? null : (
      <View style={{ marginTop: first ? 0 : sectionGap }}>
        <SectionTitle style={{ marginBottom: 6 }}>{title}</SectionTitle>
        {list.map((r, i) => {
          const line = mineLine(r, now);
          return (
            <View key={r.id} style={[styles.row, i === 0 ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.divider }]}>
              <View style={{ flex: 1, rowGap: 4 }}>
                <Text style={[styles.text, { color: palette.ink }]}>{r.text}</Text>
                <Chrome step="note" tone="muted">
                  {line}
                </Chrome>
              </View>
              <Pressable onPress={() => act(r)} accessibilityRole="button" accessibilityLabel={`Options for ${r.text}. ${line}`} style={styles.more} testID={`mine-more-${r.id}`}>
                <Icon name="more" size={20} tone="muted" />
              </Pressable>
            </View>
          );
        })}
      </View>
    );

  return (
    <PageScreen title="Your requests" back="Pray" clearTabBar testID="pray-mine">
      {mine !== null && mine.length === 0 ? (
        <Chrome tone="muted">Nothing asked yet.</Chrome>
      ) : (
        <>
          {group("Live", live, true)}
          {group("Answered", answered, live.length === 0)}
        </>
      )}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", columnGap: 8, minHeight: 56, paddingVertical: 14 },
  text: { fontFamily: FONTS.scripture, fontSize: 17, lineHeight: 24 },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});

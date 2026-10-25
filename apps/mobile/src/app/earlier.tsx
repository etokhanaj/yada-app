/**
 * Earlier days (DR-19; Build 12 ED-30, approved by John 25 Oct 2026): this month's days, newest first, Mornings or
 * Evenings as filter pills (they were interleaved, so each day showed twice), each a picture beside "Today · Psalm 1:3"
 * and its verse in Literata; a tap opens that day's verse full screen (DR-16). The psalter repeats each month, so the
 * list starts again on the 1st.
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { FilterPills } from "../components/FilterPills";
import { ListRow, PageScreen } from "../components/Page";
import { Scripture } from "../components/Type";
import { useCore } from "../data/AppData";
import { pictureFor } from "../data/pictures";
import { dayVerse, type TodayData } from "../data/today";
import { BRAND } from "../design/palette";
import { useLayout } from "../design/tokens";
import { dayOf, dayParam, earlierDays, type Part, partOf, whenLabel } from "../lib/today";
import { useSettings } from "../state/settings";

type Row = { day: Date; part: Part; verse: NonNullable<TodayData["verse"]> };

export default function EarlierDays() {
  const core = useCore();
  const { ax } = useLayout();
  const translation = useSettings((s) => s.translation);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [shown, setShown] = useState<Part>(() => partOf(new Date()));

  useFocusEffect(
    useCallback(() => {
      let live = true;
      const at = new Date();
      setNow(at);
      void Promise.all(earlierDays(at).map(async ({ day, part }) => ({ day, part, verse: await dayVerse(core, translation, day, part) }))).then(
        (all) => live && setRows(all.flatMap((r) => (r.verse === null ? [] : [{ ...r, verse: r.verse }]))),
      );
      return () => {
        live = false;
      };
    }, [core, translation]),
  );

  const today = dayOf(now);
  return (
    <PageScreen title="Earlier days" back="Today" testID="earlier-days">
      <View style={{ marginBottom: 10 }}>
        <FilterPills
          options={[
            { key: "morning", title: "Mornings" },
            { key: "evening", title: "Evenings" },
          ]}
          chosen={shown}
          onChoose={setShown}
          testID="earlier-part"
        />
      </View>
      {(rows ?? []).filter((r) => r.part === shown).map(({ day, part, verse }, i) => {
        const picture = pictureFor(day, part);
        const when = `${whenLabel(day, part, today)} · ${verse.ref}`;
        return (
          <ListRow
            key={`${dayParam(day)}-${part}`}
            first={i === 0}
            overline={when}
            label={`${when}. ${verse.text}`}
            onPress={() => router.push({ pathname: "/verse", params: { day: dayParam(day), part } })}
            testID={`earlier-${dayParam(day)}-${part}`}
          >
            <View style={[styles.row, ax ? { flexDirection: "column", alignItems: "flex-start" } : null]}>
              <View style={[styles.thumb, { backgroundColor: BRAND.night }]}>
                {/* Sized explicitly: with absoluteFill the picture drew at a far larger size and showed only its corner. */}
                {picture !== undefined ? <Image source={picture.image} style={styles.thumbImage} resizeMode="cover" accessible={false} /> : null}
              </View>
              <Scripture step="claim" numberOfLines={ax ? 6 : 2} style={{ fontFamily: "Literata", flex: ax ? undefined : 1 }}>
                {verse.text}
              </Scripture>
            </View>
          </ListRow>
        );
      })}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", columnGap: 14, rowGap: 10 },
  // The pictures' own 3:4, not DR-19's square: a square kept only their middle, which on most days is sky (simulator,
  // 18 Oct 2026: day 18 showed as a patch of cloud). Clipped so the picture never draws past it.
  thumb: { width: 54, height: 72, borderRadius: 14, overflow: "hidden" },
  thumbImage: { width: 54, height: 72 },
});

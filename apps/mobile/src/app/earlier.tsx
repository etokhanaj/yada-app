/**
 * Earlier days (DR-19): this month's days, newest first, each a small picture beside "Today · Psalm 1:3" and its
 * verse in quotes; a tap opens that day's verse full screen (DR-16). The psalter repeats each month, so the list
 * starts again on the 1st. Mornings and evenings each show their own picture.
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { ListRow, PageScreen } from "../components/Page";
import { Scripture } from "../components/Type";
import { useCore } from "../data/AppData";
import { pictureFor } from "../data/pictures";
import { dayVerse, type TodayData } from "../data/today";
import { BRAND } from "../design/palette";
import { useLayout } from "../design/tokens";
import { dayOf, dayParam, earlierDays, type Part, whenLabel } from "../lib/today";
import { useSettings } from "../state/settings";

type Row = { day: Date; part: Part; verse: NonNullable<TodayData["verse"]> };

export default function EarlierDays() {
  const core = useCore();
  const { ax } = useLayout();
  const translation = useSettings((s) => s.translation);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [now, setNow] = useState(() => new Date());

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
      {(rows ?? []).map(({ day, part, verse }, i) => {
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
                {`“${verse.text}”`}
              </Scripture>
            </View>
          </ListRow>
        );
      })}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", columnGap: 12, rowGap: 10 },
  // The pictures' own 3:4, not DR-19's square: a square kept only their middle, which on most days is sky (simulator,
  // 18 Oct 2026: day 18 showed as a patch of cloud). Clipped so the picture never draws past it.
  thumb: { width: 54, height: 72, borderRadius: 10, overflow: "hidden" },
  thumbImage: { width: 54, height: 72 },
});

/**
 * You (Build 12 YO-30): from the person beside Today's lamp, and from the lamp itself. Two stat tiles, this week's
 * dots, then what is yours: Saved, Your requests, Reminders, Translation, each a row with its tinted mark and what it
 * holds. Recent and Settings sit under ⋯, moved from the Bible tab's ⋯ with Saved's bookmark (plan 12e).
 *
 * It replaces Your rhythm (RT-02). The days this year stay first, as RT-02 and design-system.md set them, though the
 * frame draws the run first: a run that restarts at 1 read as a reset. Nothing shows a best, a record or a lost run.
 * The year grid and its "How it works" lines are not on YO-30 and went with the sheet.
 */

import { MenuView } from "@react-native-menu/menu";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { circlesCloud, prayCloud } from "../../modules/yada-pray";
import { GlassButton } from "../components/Glass";
import { Icon, type IconName } from "../components/Icon";
import { ListRow, PageScreen } from "../components/Page";
import { StatTile, TileGrid } from "../components/Tiles";
import { Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { useReminder } from "../data/reminder";
import { listBookmarks, listHighlights, listNotes, listVerseImages, loadDays, subscribeYourSpace } from "../data/user";
import type { Tint } from "../design/palette";
import { usePalette } from "../design/tokens";
import { asRequest } from "../lib/askSomeone";
import { reminderSummary } from "../lib/reminder";
import { type Rhythm, rhythmOf, thisWeek, todayKey } from "../lib/rhythm";
import { savedLine } from "../lib/saved";
import { useSettings } from "../state/settings";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function You() {
  const palette = usePalette();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const reminder = useReminder((s) => s.prefs);
  const [days, setDays] = useState<{ rhythm: Rhythm; all: string[] } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Live requests, asked of everyone and of one person; unknown (no value shown) until iCloud answers.
  const [asked, setAsked] = useState<number | null>(null);

  const reload = useCallback(() => {
    void loadDays(user).then((all) => setDays({ all, rhythm: rhythmOf(all, todayKey(new Date())) }));
    void Promise.all([listHighlights(user), listNotes(user), listBookmarks(user), listVerseImages(user)]).then(([h, n, b, i]) =>
      setSaved(savedLine({ highlights: h.length, notes: n.length, bookmarks: b.length, images: i.length })),
    );
    void prayCloud
      ?.mine()
      .then(async (mine) => {
        const ones = (await circlesCloud?.asks().catch(() => [])) ?? [];
        setAsked([...mine, ...ones.map(asRequest)].filter((r) => r.answeredAt === undefined).length);
      })
      .catch(() => setAsked(null));
  }, [user]);
  useFocusEffect(reload);
  // A highlight or note changed in a sheet over You never blurs this page.
  useEffect(() => subscribeYourSpace(reload), [reload]);

  const today = todayKey(new Date());
  const week = days === null ? [] : thisWeek(days.all, today);
  const value = (text: string) => (
    <Chrome step="note" tone="muted">
      {text}
    </Chrome>
  );
  const mark = (icon: IconName, tint: Tint) => (
    <View style={[styles.mark, { backgroundColor: palette.tints[tint] }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon name={icon} size={20} />
    </View>
  );

  return (
    <PageScreen
      title="You"
      back="Today"
      testID="you"
      right={
        <MenuView
          shouldOpenOnLongPress={false}
          actions={[
            // imageColor always set: without it @react-native-menu draws the glyph transparent (index.tsx, 10 Oct 2026).
            { id: "recent", title: "Recent", image: "clock", imageColor: palette.ink },
            { id: "settings", title: "Settings", image: "gearshape", imageColor: palette.ink },
          ]}
          onPressAction={({ nativeEvent }) => router.push(nativeEvent.event === "recent" ? "/recent" : "/settings")}
          testID="you-more"
        >
          {/* The menu is a UIButton; a child that took the touch would keep it from opening. */}
          <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel="More: Recent, Settings">
            <GlassButton>
              <Icon name="more" size={20} />
            </GlassButton>
          </View>
        </MenuView>
      }
    >
      {days === null ? null : (
        <>
          <TileGrid>
            <StatTile label="Days this year" value={String(days.rhythm.thisYear)} testID="you-year" />
            <StatTile label="Days in a row" value={String(days.rhythm.streak)} testID="you-run" />
          </TileGrid>
          <View
            style={styles.week}
            accessible
            accessibilityLabel={`This week: ${week.flatMap((d, i) => (d.counted ? [WEEKDAY_NAMES[i]] : [])).join(", ") || "no days yet"}`}
            testID="you-week"
          >
            {week.map((d, i) => (
              <View key={d.key} style={styles.weekDay}>
                <Chrome step="note" tone="muted" maxFontSizeMultiplier={1.6}>
                  {WEEKDAYS[i]}
                </Chrome>
                <View style={[styles.dot, { borderColor: d.today ? palette.ink : "transparent", backgroundColor: d.counted ? palette.accent : palette.fill }]} />
              </View>
            ))}
          </View>
        </>
      )}
      <View style={{ marginTop: 14 }}>
        <ListRow
          first
          leading={mark("bookmark", "sand")}
          title="Saved"
          right={saved === null ? undefined : value(saved)}
          label={saved === null ? "Saved" : `Saved, ${saved}`}
          onPress={() => router.push({ pathname: "/saved", params: { back: "You" } })}
          testID="you-saved"
        />
        {prayCloud === null ? null : (
          <ListRow
            leading={mark("heart-hand", "sky")}
            title="Your requests"
            right={asked === null || asked === 0 ? undefined : value(`${asked} asked`)}
            label={asked === null || asked === 0 ? "Your requests" : `Your requests, ${asked} asked`}
            onPress={() => router.push("/pray/mine")}
            testID="you-requests"
          />
        )}
        <ListRow
          // No bell in the icon set (scripts/sync-icons.mjs); the calendar is the reminder's days.
          leading={mark("calendar", "forest")}
          title="Reminders"
          right={value(reminderSummary(reminder))}
          label={`Reminders, ${reminderSummary(reminder)}`}
          onPress={() => router.push("/reminder")}
          testID="you-reminders"
        />
        <ListRow
          leading={mark("book-open", "clay")}
          title="Translation"
          right={value(translation)}
          label={`Translation, ${translation}`}
          onPress={() => router.push("/translations")}
          testID="you-translation"
        />
      </View>
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, marginHorizontal: 4 },
  weekDay: { alignItems: "center", rowGap: 6, minWidth: 32 },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5 },
  // YO-30's 44 pt mark, 12 pt corners, as Add or ask's (pray/add-or-ask.tsx).
  mark: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});

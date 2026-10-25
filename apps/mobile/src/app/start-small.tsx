/**
 * Start small (canvas RT-07; John approved 18 Oct 2026): three ways in, each with the words you would read and how long
 * it takes. The name is "Start small" everywhere, on the link and here (UX pass: one name).
 *
 * What counts: the day's verse counts when the reader taps Done on it on Today; opening the app never counts (John,
 * 18 Oct 2026; DR-21 amended). A psalm or the saved place count the way reading always does, when it is read to its end.
 * So this sheet only takes the reader to the words.
 *
 * The words are the reader's own translation where it has the verse, otherwise the BSB (as Today does). Cards: one per
 * thing you tap, a soft fill, one 24 pt radius, no shadow (CLAUDE.md, John 15 Oct 2026). Style after Oura (RT-07's frame).
 */

import { type BookCode, parseVerseId, verseOrd } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { readerHref } from "../components/navigation";
import { useLayout } from "../design/tokens";
import { SheetScreen } from "../components/Sheet";
import { Chrome } from "../components/Type";
import { useCore } from "../data/AppData";
import { getTexts } from "../data/queries";
import { FONTS, usePalette } from "../design/tokens";
import { verseFor } from "../lib/dailyLight";
import { dayOf, partOf } from "../lib/today";
import { minutesLabel, minutesSpoken, smallOptions, type SmallKind } from "../lib/lapse";
import { chapterTitle, excerptOf, shortRef } from "../lib/reader";
import { useSettings } from "../state/settings";

interface Words {
  readonly text: string;
  readonly ref: string;
}

export default function StartSmallScreen() {
  const fitSheet = !useLayout().ax;
  const { place } = useLocalSearchParams<{ place?: string }>();
  const at = place === undefined || place === "" ? null : parseVerseId(place);
  const core = useCore();
  const palette = usePalette();
  const translation = useSettings((s) => s.translation);
  const [words, setWords] = useState<Partial<Record<SmallKind, Words>>>({});

  useEffect(() => {
    let live = true;
    void (async () => {
      const out: Partial<Record<SmallKind, Words>> = {};
      // The BSB stands in when the reader's version lacks the verse or is licensed (rule 9), and the ref then says so,
      // as Today and Home do (US-11).
      const wordsAt = async (book: BookCode, chapter: number, verse: number, ref: string): Promise<Words> => {
        const texts = await getTexts(core, verseOrd(book, chapter, verse));
        const own = texts[translation];
        return own !== undefined ? { text: excerptOf(own), ref } : { text: excerptOf(texts["BSB"] ?? ""), ref: `${ref} · BSB` };
      };
      // The same verse Today shows (Daily Light's headline for this part of the day).
      const now = new Date();
      const day = verseFor(dayOf(now), partOf(now));
      const dayPlace = { book: day.book, chapter: day.chapter, verse: day.verse };
      out.verse = await wordsAt(dayPlace.book, dayPlace.chapter, dayPlace.verse, shortRef(dayPlace));
      out.psalm = await wordsAt("PSA", 23, 1, "Psalm 23:1");
      if (at !== null) out.continue = await wordsAt(at.book, at.chapter, at.verse, shortRef(at));
      if (live) setWords(out);
    })();
    return () => {
      live = false;
    };
  }, [core, translation, place]);

  const options = smallOptions(at === null ? null : chapterTitle(at.book, at.chapter));
  const go = (kind: SmallKind) => {
    if (kind === "verse") {
      // Today holds the verse and its Done.
      router.dismissAll();
      router.navigate("/today");
    } else if (kind === "psalm") {
      router.dismissAll();
      router.push(readerHref({ book: "PSA", chapter: 23, verse: 1, resume: true }));
    } else if (at !== null) {
      router.dismissAll();
      router.push(readerHref({ book: at.book, chapter: at.chapter, verse: Math.max(1, at.verse - 1), resume: true, hold: at.verse }));
    }
  };

  return (
    <SheetScreen fit={fitSheet} title="Start small" backLabel={null} noBack footer={false} testID="start-small">
      <View style={{ rowGap: 10 }}>
        {options.map((o) => {
          const w = words[o.kind];
          return (
            <Pressable
              key={o.kind}
              onPress={() => go(o.kind)}
              accessibilityRole="button"
              accessibilityLabel={`${o.title}. ${w === undefined ? "" : `${w.text}, ${w.ref}. `}${minutesSpoken(o.minutes)}`}
              style={({ pressed }) => [styles.card, { backgroundColor: palette.card, opacity: pressed ? 0.85 : 1 }]}
              testID={`small-${o.kind}`}
            >
              <View style={styles.head}>
                <Chrome step="note" tone="muted" style={{ fontWeight: "600", flexShrink: 1 }}>
                  {o.title}
                </Chrome>
                <Chrome step="note" tone="accent" style={{ fontWeight: "600" }}>
                  {minutesLabel(o.minutes)}
                </Chrome>
              </View>
              {w === undefined ? null : (
                <>
                  <Chrome tone="ink" numberOfLines={3} style={styles.verse}>
                    {w.text}
                  </Chrome>
                  <Chrome step="note" tone="muted">
                    {w.ref}
                  </Chrome>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20, rowGap: 6, minHeight: 44 },
  head: { flexDirection: "row", justifyContent: "space-between", columnGap: 12 },
  verse: { fontFamily: FONTS.scripture, fontSize: 19, lineHeight: 27, fontWeight: "400" },
});

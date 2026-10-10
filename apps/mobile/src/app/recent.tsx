/**
 * Recent (canvas R-01, E-05; PRD §8.6): the verses the reader looked
 * underneath, newest first, from the local event log. The tag names the word
 * that was opened, or `Understand` for everything opened from there (brief §4).
 * Nothing here leaves the device.
 */

import { parseVerseId, verseOrd } from "@yada/schema";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { readerHref } from "../components/navigation";
import { DivineText } from "../components/Verse";
import { ListRow, PageScreen } from "../components/Page";
import { Chrome, languageOf, Scripture } from "../components/Type";
import { useAppData, useCore, useQuery } from "../data/AppData";
import { getLexeme, getTextsForOrds } from "../data/queries";
import { recentlyExplored } from "../data/user";
import { FONTS, useLayout, usePalette } from "../design/tokens";
import { excerptOf } from "../lib/reader";
import { recentTag, verseLabel } from "../lib/saved";
import { useSettings } from "../state/settings";

interface RecentItem {
  readonly verseId: string;
  readonly tag: string;
}

export default function RecentScreen() {
  const palette = usePalette();
  const core = useCore();
  const { user } = useAppData();
  const { ax } = useLayout();
  const translation = useSettings((s) => s.translation);
  const [items, setItems] = useState<RecentItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const rows = await recentlyExplored(user);
        const out = await Promise.all(
          rows.map(async (r) => {
            if (r.name !== "word_open") return { verseId: r.verse_id, tag: recentTag(r.name, null) };
            // A word card logs its occurrence key as the detail (evidence/word.tsx); the tag is that word's lemma.
            const key = r.detail;
            const lexeme = key === null ? null : await getLexeme(core, key);
            return { verseId: r.verse_id, tag: recentTag(r.name, lexeme?.lemma ?? null) };
          }),
        );
        if (live) setItems(out);
      })();
      return () => {
        live = false;
      };
    }, [user, core]),
  );

  const refs = (items ?? []).flatMap((item) => {
    const ref = parseVerseId(item.verseId);
    return ref === null ? [] : [{ item, ref, ord: verseOrd(ref.book, ref.chapter, ref.verse) }];
  });
  const ords = refs.map((r) => r.ord);
  const { data: texts } = useQuery(() => getTextsForOrds(core, ords, translation), [ords.join(","), translation]);

  return (
    <PageScreen title="Recent" testID="recent">
      {items !== null && refs.length === 0 ? (
        <View>
          <Chrome tone="ink" style={styles.empty} maxFontSizeMultiplier={2.2}>
            Nothing yet.
          </Chrome>
          <Chrome step="note" tone="muted">
            Verses you explore appear here.
          </Chrome>
        </View>
      ) : null}
      {refs.map(({ item, ref, ord }, i) => {
        const label = verseLabel(ref);
        const excerpt = excerptOf(texts?.get(ord) ?? "");
        const lang = languageOf(item.tag);
        return (
          <ListRow
            key={item.verseId}
            first={i === 0}
            chevron={false}
            onPress={() => router.push(readerHref({ book: ref.book, chapter: ref.chapter, verse: ref.verse, select: true }))}
            label={`${label}, ${item.tag}. ${excerpt}`}
            testID={`recent-${item.verseId}`}
            overline={
              <>
                {label} ·{" "}
                <Text
                  style={{
                    color: palette.ink,
                    fontWeight: "600",
                    fontFamily: lang === "he" ? FONTS.hebrew : lang === "el" ? FONTS.greek : undefined,
                  }}
                >
                  {item.tag}
                </Text>
              </>
            }
          >
            <Scripture step="claim" numberOfLines={ax ? 3 : 2} style={{ fontFamily: "Literata" }}>
              <DivineText text={excerpt} translation={translation} />
            </Scripture>
          </ListRow>
        );
      })}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: "Literata",
    fontSize: 22,
    lineHeight: 29,
    marginBottom: 6,
  },
});

/**
 * Sources (canvas SO-01, SO-02), formerly Library: what is explained so far,
 * then where every word of text and data comes from.
 *
 * Every bundle ships inside the app (John's decision 4), so there are no file
 * sizes and nothing to manage: one line says it all works offline (S13, S14).
 * Rows are Apple Settings' plain disclosure rows, the whole row the target
 * (https://mobbin.com/screens/9343e7b1-2483-4855-9655-0785d42c88a6; S19).
 *
 * Licences come from the core bundle's `sources` table (rule 3). Its
 * `encumbered` notes are the team's open legal questions, not terms for
 * readers, and stay out of the UI (S15); PRD 0E still has to close them.
 */

import { parseVerseId } from "@yada/schema";
import { router } from "expo-router";
import { Linking, View } from "react-native";

import { readerHref } from "../components/navigation";
import { DivineText } from "../components/Verse";
import { ListRow, PageScreen } from "../components/Page";
import { Label, Scripture } from "../components/Type";
import { useCore, useQuery } from "../data/AppData";
import { UNDERSTAND_BUNDLES } from "../data/bundles";
import { bookBounds, getSources, getTextsForOrds } from "../data/queries";
import { loadEntriesInRange } from "../data/understand";
import { useLayout } from "../design/tokens";
import { excerptOf } from "../lib/reader";
import { verseLabel } from "../lib/saved";
import { type SourceGroup, sourceItems } from "../lib/sources";
import { useSettings } from "../state/settings";

const GROUPS: readonly SourceGroup[] = ["Bible text", "Word data"];

export default function SourcesScreen() {
  const core = useCore();
  const { ax, sectionGap } = useLayout();
  const translation = useSettings((s) => s.translation);
  const { data: sources } = useQuery(() => getSources(core), []);
  const { data: explained } = useQuery(async () => {
    const books = UNDERSTAND_BUNDLES.flatMap((b) => (b.book === undefined ? [] : [b.book]));
    const rows = (await Promise.all(books.map((book) => loadEntriesInRange(book, ...bookBounds(book))))).flat();
    rows.sort((a, b) => a.ord - b.ord);
    const texts = await getTextsForOrds(core, rows.map((r) => r.ord), translation);
    return rows.flatMap((r) => {
      const ref = parseVerseId(r.verse_id);
      return ref === null ? [] : [{ id: r.verse_id, ref, text: excerptOf(texts.get(r.ord) ?? "") }];
    });
  }, [translation]);
  const items = sourceItems(sources ?? []);

  return (
    <PageScreen title="Sources" subtitle="All of it is on your iPhone. Nothing needs a connection." testID="sources">
      {explained !== undefined && explained.length > 0 ? (
        <View>
          <Label style={{ marginBottom: 6 }}>
            Explained so far · {explained.length} {explained.length === 1 ? "verse" : "verses"}
          </Label>
          {explained.map(({ id, ref, text }, i) => {
            const label = verseLabel(ref);
            return (
              <ListRow
                key={id}
                first={i === 0}
                title={label}
                label={`${label}. ${text}`}
                onPress={() => router.push(readerHref({ book: ref.book, chapter: ref.chapter, verse: ref.verse, select: true }))}
                testID={`explained-${id}`}
                subtitle={
                  <Scripture
                    step="claim"
                    tone="muted"
                    numberOfLines={ax ? 3 : 1}
                    style={{ fontFamily: "Literata" }}
                  >
                    <DivineText text={text} />
                  </Scripture>
                }
              />
            );
          })}
        </View>
      ) : null}

      {GROUPS.map((group) => {
        const rows = items.filter((item) => item.group === group);
        if (rows.length === 0) return null;
        return (
          <View key={group} style={{ marginTop: sectionGap }}>
            <Label style={{ marginBottom: 6 }}>{group}</Label>
            {rows.map((item, i) => (
              <ListRow
                key={item.dataset}
                first={i === 0}
                title={item.title}
                subtitle={item.subtitle}
                label={item.label}
                onPress={() => void Linking.openURL(item.url)}
                testID={`source-${item.title}`}
              />
            ))}
          </View>
        );
      })}
    </PageScreen>
  );
}

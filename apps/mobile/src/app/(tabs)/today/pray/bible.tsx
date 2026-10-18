/**
 * Prayers of the Bible (PR-08): a list of prayers in Scripture, each title in Literata over its reference; a row opens
 * the passage in the reader. The list is data (data/prayersOfTheBible.ts): the 39 John approved on 18 Oct 2026. Pray
 * hides its row for this page if the list is ever empty.
 */

import { router } from "expo-router";

import { readerHref } from "../../../../components/navigation";
import { ListRow, PageScreen } from "../../../../components/Page";
import { PRAYERS_OF_THE_BIBLE, prayerRef } from "../../../../data/prayersOfTheBible";

export default function PrayersOfTheBible() {
  return (
    <PageScreen title="Prayers of the Bible" back="Pray" clearTabBar testID="pray-bible">
      {PRAYERS_OF_THE_BIBLE.map((p, i) => (
        <ListRow
          key={`${p.book}.${p.chapter}.${p.from}`}
          first={i === 0}
          book
          title={p.title}
          subtitle={prayerRef(p)}
          label={`${p.title}, ${prayerRef(p)}`}
          onPress={() => router.push(readerHref({ book: p.book, chapter: p.chapter, verse: p.from, to: p.to, select: true, back: "Prayers of the Bible" }))}
        />
      ))}
    </PageScreen>
  );
}

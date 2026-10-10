import { BOOK_CODES, BOOK_ORDER, type BookCode, isBookCode } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import type { ScrollView } from "react-native";
import { View } from "react-native";

import { TranslationSwitch } from "../../components/Contents";
import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { Chrome, Label } from "../../components/Type";

/** Books, the one being read marked `Reading` with the wash and bar (C-01). */
export default function ContentsBooks() {
  const params = useLocalSearchParams<{ book?: string; chapter?: string }>();
  const current: BookCode | null = params.book !== undefined && isBookCode(params.book) ? params.book : null;
  const scroll = useRef<ScrollView>(null);
  const scrolled = useRef(false);

  const groups = [
    { title: "Old Testament", books: BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "OT") },
    { title: "New Testament", books: BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "NT") },
  ];
  // The testament being read comes first, as the canvas draws it from 1 Corinthians.
  if (current !== null && BOOK_CODES[current].testament === "NT") groups.reverse();

  return (
    <SheetScreen title="Contents" backLabel={null} footer={false} scrollRef={scroll} testID="contents">
      <TranslationSwitch />
      {groups.map((group, gi) => (
        <View key={group.title} style={{ marginTop: gi === 0 ? 0 : 28 }}>
          <Label style={{ marginBottom: 6 }}>{group.title}</Label>
          {group.books.map((book, i) => {
            const reading = book === current;
            return (
              <View
                key={book}
                onLayout={
                  reading
                    ? (e) => {
                        if (scrolled.current) return;
                        scrolled.current = true;
                        const y = e.nativeEvent.layout.y;
                        // Opens with the book being read in view, not at Genesis.
                        if (y > 400) requestAnimationFrame(() => scroll.current?.scrollTo({ y: y - 200, animated: false }));
                      }
                    : undefined
                }
              >
                <ListRow
                  first={i === 0}
                  book
                  here={reading}
                  title={BOOK_CODES[book].name}
                  right={
                    reading ? (
                      <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
                        Reading
                      </Chrome>
                    ) : undefined
                  }
                  label={`${BOOK_CODES[book].name}${reading ? ", reading" : ""}`}
                  onPress={() =>
                    router.push({
                      pathname: "/contents/[book]",
                      params: { book, chapter: reading ? (params.chapter ?? "") : "" },
                    })
                  }
                  testID={`contents-${book}`}
                />
              </View>
            );
          })}
        </View>
      ))}
    </SheetScreen>
  );
}

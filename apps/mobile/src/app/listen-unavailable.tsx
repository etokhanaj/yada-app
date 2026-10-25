/**
 * LS-31 (Build 12, John 24 Oct 2026): the reading can't be had, so nothing reads. It replaced the iPhone voice reading
 * in Heart's place. Offline with the book not on the phone, it offers the book's download, which starts by itself
 * when the connection is back; a reading that didn't load offers Try again. Not now leaves the reading paused where
 * it stopped. It opens over whatever screen Listen was pressed on (_layout.tsx follows `unavailable`).
 */

import { BOOK_CODES } from "@yada/schema";
import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { Pill } from "../components/Pill";
import { SheetScreen } from "../components/Sheet";
import { Chrome } from "../components/Type";
import { tryAgain } from "../data/audio";
import { downloadWhenOnline, readingOf, readText } from "../data/recordings";
import { useLayout } from "../design/tokens";
import { useAudio } from "../state/audio";

export default function ListenUnavailable() {
  const fitSheet = !useLayout().ax;
  const unavailable = useAudio((s) => s.unavailable);
  const { ax } = useLayout();
  // Closed by a swipe as well as by its buttons: either way the question is answered.
  useEffect(() => () => useAudio.setState({ unavailable: null }), []);
  if (unavailable === null) return null;

  const text = readText(unavailable.translation) ?? "BSB";
  const info = readingOf(unavailable.book, text);
  const book = BOOK_CODES[unavailable.book].name;
  const megabytes = info === undefined ? null : Math.max(1, Math.round(info.chapters.reduce((n, c) => n + c.bytes, 0) / 1_000_000));
  const offline = unavailable.reason === "offline";
  const line = offline
    ? `${info?.narrator_name ?? "Heart"} can read ${book} once it’s downloaded.${megabytes === null ? "" : ` About ${megabytes} MB.`}`
    : null;

  return (
    <SheetScreen fit={fitSheet} title={offline ? "You’re offline" : "This reading didn’t load"} backLabel={null} noBack footer={false} testID="listen-unavailable">
      {line === null ? null : <Chrome tone="muted">{line}</Chrome>}
      <View style={{ rowGap: 8, marginTop: 18 }}>
        {offline ? (
          <Pill
            title="Download when online"
            primary
            stretch
            onPress={() => {
              downloadWhenOnline(unavailable.book, text);
              router.back();
            }}
            label={`Download ${book} when online`}
            testID="listen-download"
          />
        ) : (
          <Pill
            title="Try again"
            primary
            stretch
            onPress={() => {
              router.back();
              void tryAgain();
            }}
            testID="listen-try-again"
          />
        )}
        <Pill title="Not now" stretch={!ax} onPress={() => router.back()} testID="listen-not-now" />
      </View>
    </SheetScreen>
  );
}

/**
 * Voice (canvas BA-03, BA-04, BA-07, BA-08): the book's readings by Heart and George, the computer voices
 * John kept (13 Oct 2026: Barry Hays and the iPhone voice are not offered), and the chosen reading of the
 * book to keep offline. A list with the choice ticked at the trailing edge (Mobbin: Perplexity, Voice
 * settings, https://mobbin.com/screens/0d1d90d6-e5d0-4e68-836c-418527ab5d0f), each voice with one line under
 * its name (Mindtrip, https://mobbin.com/screens/8bd744e2-1695-43fa-a198-f0fab97d4702). A computer voice says
 * so in its own row (John, 12 Oct 2026: the voice is generated, the words are the BSB's).
 */

import { MenuView } from "@react-native-menu/menu";
import * as Haptics from "expo-haptics";
import { BOOK_CODES } from "@yada/schema";
import { View } from "react-native";

import { StopRing } from "../components/audio/ReaderBars";
import { Icon } from "../components/Icon";
import { Row, RowNote, Section, SheetScreen } from "../components/Sheet";
import { Chrome } from "../components/Type";
import { chooseReading } from "../data/audio";
import { bookOnPhone, downloadBook, readingKey, readingsOf, readText, removeBook, stopBookDownload, useRecordings } from "../data/recordings";
import { formatMB } from "../lib/progress";
import { chapterTitle } from "../lib/reader";
import { useAudio } from "../state/audio";

export default function VoiceScreen() {
  const session = useAudio((s) => s.session);
  // The session's text: each has its own reading and download (LB-09–11). A licensed page's session reads the BSB.
  const text = (session === null ? null : readText(session.translation)) ?? "BSB";
  const key = session === null ? "" : readingKey(session.book, text);
  const info = useRecordings((s) => s.books[key]);
  const downloading = useRecordings((s) => s.downloading[key]);
  const failed = useRecordings((s) => s.failed[key]);
  useRecordings((s) => s.version);
  useRecordings((s) => s.all);
  if (session === null) return null;
  const book = BOOK_CODES[session.book].name;
  const here = bookOnPhone(session.book, text);
  const readings = readingsOf(session.book, text);
  // One voice reads the WEB, KJV and LSV (John, 13 Oct 2026): it is named, with nothing to choose (LB-10).
  const choice = readings.length > 1;
  const all = here.total > 0 && here.chapters === here.total;
  const tick = <Icon name="check" size={18} tone="accent" />;
  // Download and its size are the chosen reading's; a computer voice is named here as everywhere.
  const voiceOf = info === undefined ? "" : `${info.narrator_name}, computer voice · `;

  return (
    <SheetScreen title="Voice" subtitle={`${chapterTitle(session.book, session.chapter)} · ${session.translation}`} backLabel={null} noBack footer={false} closeLabel="Close" testID="voice-sheet">
      {readings.map((reading, i) => {
        // Only the reading playing is ticked. While the iPhone voice reads (offline, or a reading that didn't
        // load) neither is, since a tick on Heart beside "iPhone voice" said two things (UX pass, 15 Oct 2026).
        const on = choice && session.recorded === true && info?.narrator === reading.narrator;
        return (
          <Row
            key={reading.narrator}
            first={i === 0}
            chevron={false}
            selected={on}
            trailing={on ? tick : null}
            label={`${reading.narrator_name}, computer voice`}
            {...(choice ? { onPress: () => void chooseReading(reading.narrator) } : {})}
            testID={`voice-${reading.narrator}`}
          >
            <Chrome tone="ink" style={{ fontWeight: "500" }}>
              {reading.narrator_name}
            </Chrome>
            <RowNote>Computer voice</RowNote>
          </Row>
        );
      })}
      {info !== undefined ? (
        <Section title="Download">
          {downloading !== undefined ? (
            // BA-04: the ring stops the download; the chapters already fetched stay on the phone.
            <Row
              first
              chevron={false}
              label={`Downloading ${book}, ${downloading.done} of ${downloading.total} chapters. Stop downloading`}
              onPress={() => stopBookDownload(session.book, text)}
              trailing={<StopRing share={downloading.total === 0 ? 0 : downloading.done / downloading.total} size={36} />}
              testID="voice-downloading"
            >
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                {`Downloading ${book}`}
              </Chrome>
              <RowNote>{`${downloading.done} of ${downloading.total} chapters`}</RowNote>
            </Row>
          ) : all ? (
            // BA-07: a downloaded book has one action, under ⋯.
            <MenuView
              shouldOpenOnLongPress={false}
              actions={[{ id: "remove", title: `Remove ${book}’s audio`, attributes: { destructive: true } }]}
              onPressAction={() => removeBook(session.book, undefined, text)}
              testID="voice-downloaded"
            >
              {/* The menu is a UIButton; its child takes no touch and speaks as the one button (settings.tsx). */}
              <View
                pointerEvents="none"
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${book} is downloaded, ${here.total} ${here.total === 1 ? "chapter" : "chapters"}, ${formatMB(here.bytes)}. More, Remove`}
                style={{ minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 12, paddingVertical: 12 }}
              >
                <View style={{ flex: 1, rowGap: 4 }}>
                  <Chrome tone="ink" style={{ fontWeight: "500" }}>
                    {`${book} is downloaded`}
                  </Chrome>
                  <RowNote>{`${voiceOf}${here.total} ${here.total === 1 ? "chapter" : "chapters"} · ${formatMB(here.bytes)}`}</RowNote>
                </View>
                <Icon name="more" size={20} tone="muted" />
              </View>
            </MenuView>
          ) : (
            <Row
              first
              trailing={<Icon name="download" size={20} tone="accent" />}
              // Success when the book the reader asked for lands on the open sheet; a warning only after
              // their own download failed (review §4). Play, pause and advancing never tick.
              onPress={() =>
                void downloadBook(session.book, text).then((ok) => Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning))
              }
              testID="voice-download"
            >
              <Chrome tone="ink" style={{ fontWeight: "500" }}>
                {`Download ${book}`}
              </Chrome>
              {/* LB-10: "21 chapters · 34 MB"; the voice it downloads is the one ticked or named above. */}
              <RowNote>{`${here.total} ${here.total === 1 ? "chapter" : "chapters"} · ${formatMB(here.bytes)}`}</RowNote>
            </Row>
          )}
          {failed === "space" ? (
            <Chrome step="note" tone="muted" role="status" style={{ marginTop: 6 }} testID="voice-no-space">
              {`Not enough space on this iPhone to download ${book}.`}
            </Chrome>
          ) : failed === "network" ? (
            <Chrome step="note" tone="muted" role="status" style={{ marginTop: 6 }}>
              {`${book} didn’t finish downloading.`}
            </Chrome>
          ) : null}
        </Section>
      ) : null}
    </SheetScreen>
  );
}

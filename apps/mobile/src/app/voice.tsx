/**
 * RD-34 Voice: Heart or George, each with a sample to hear it by (the two rows look alike; the choice is the tick),
 * the reading speed, and the book to keep for offline with its size. Only Heart and George read (John, 13 Oct 2026;
 * the iPhone voice went in Build 12). A list with the choice ticked at the trailing edge (Mobbin: Perplexity, Voice
 * settings, https://mobbin.com/screens/0d1d90d6-e5d0-4e68-836c-418527ab5d0f). Opened from the docked player's
 * "Heart · 1×" (RD-32) and the full player's voice line.
 */

import { MenuView } from "@react-native-menu/menu";
import * as Haptics from "expo-haptics";
import { BOOK_CODES } from "@yada/schema";
import { Pressable, StyleSheet, View } from "react-native";

import { MediaIcon } from "../components/audio/MediaIcon";
import { StopRing } from "../components/audio/ReaderBars";
import { Icon } from "../components/Icon";
import { Pill } from "../components/Pill";
import { Segmented } from "../components/Segmented";
import { Row, RowNote, SheetScreen } from "../components/Sheet";
import { Chrome } from "../components/Type";
import { chooseReading, playSample, setSpeed } from "../data/audio";
import { bookOnPhone, downloadBook, READ_TEXTS, readingKey, readingsOf, readText, removeBook, stopBookDownload, useRecordings } from "../data/recordings";
import { usePalette } from "../design/tokens";
import { SPEEDS, speedLabel } from "../lib/audio/session";
import { formatMB } from "../lib/progress";
import { useAudio } from "../state/audio";

/** "the BSB, WEB and LSV": the texts a voice reads in this book, from the manifest (rule 4). */
function textsList(texts: readonly string[]): string {
  if (texts.length <= 1) return `the ${texts[0] ?? ""}`;
  return `the ${texts.slice(0, -1).join(", ")} and ${texts[texts.length - 1] ?? ""}`;
}

export default function VoiceScreen() {
  const palette = usePalette();
  const session = useAudio((s) => s.session);
  const speed = useAudio((s) => s.speed);
  // The session's text: each has its own reading and download (LB-09–11). A licensed page's session reads the BSB.
  const text = (session === null ? null : readText(session.translation)) ?? "BSB";
  const key = session === null ? "" : readingKey(session.book, text);
  const info = useRecordings((s) => s.books[key]);
  const downloading = useRecordings((s) => s.downloading[key]);
  const failed = useRecordings((s) => s.failed[key]);
  const all = useRecordings((s) => s.all);
  useRecordings((s) => s.version);
  if (session === null) return null;
  const book = BOOK_CODES[session.book].name;
  const here = bookOnPhone(session.book, text);
  const readings = readingsOf(session.book, text);
  // One voice reads the WEB, KJV and LSV (John, 13 Oct 2026): it is named, with nothing to choose (LB-10).
  const choice = readings.length > 1;
  const downloaded = here.total > 0 && here.chapters === here.total;
  const chapters = `${here.total} ${here.total === 1 ? "chapter" : "chapters"}`;

  return (
    <SheetScreen title="Voice" backLabel={null} noBack footer={false} closeLabel="Close" testID="voice-sheet">
      {readings.map((reading, i) => {
        // Only the reading playing is ticked: while neither can be had (offline, or a reading that didn't load,
        // LS-31) neither is (UX pass, 15 Oct 2026).
        const on = choice && session.recorded === true && info?.narrator === reading.narrator;
        const texts = READ_TEXTS.filter((t) => all.some((a) => a.book === session.book && a.narrator === reading.narrator && a.translation === t));
        const reads = `Reads ${textsList(texts)}`;
        return (
          <View key={reading.narrator} style={[styles.row, i === 0 ? null : { boxShadow: `0 -1px 0 ${palette.divider}` }]}>
            <Pressable
              onPress={() => void playSample(reading.narrator)}
              accessibilityRole="button"
              accessibilityLabel={`Hear ${reading.narrator_name}`}
              style={({ pressed }) => [styles.round, { backgroundColor: palette.fill }, pressed ? styles.pressed : null]}
              testID={`voice-sample-${reading.narrator}`}
            >
              <MediaIcon name="play" size={18} maxScale={1.5} />
            </Pressable>
            <Pressable
              {...(choice ? { onPress: () => void chooseReading(reading.narrator) } : {})}
              disabled={!choice}
              accessibilityRole={choice ? "button" : undefined}
              // The computer voice is said to VoiceOver as it was named on screen before RD-34 (John, 12 Oct 2026).
              accessibilityLabel={`${reading.narrator_name}, computer voice. ${reads}`}
              accessibilityState={choice ? { selected: on } : undefined}
              style={({ pressed }) => [styles.choose, pressed && choice ? styles.pressed : null]}
              testID={`voice-${reading.narrator}`}
            >
              <View style={styles.text}>
                <Chrome tone="ink" style={{ fontWeight: "600" }}>
                  {reading.narrator_name}
                </Chrome>
                <RowNote>{reads}</RowNote>
              </View>
              {on ? <Icon name="check" size={18} tone="accent" /> : null}
            </Pressable>
          </View>
        );
      })}
      <View style={{ marginTop: 14 }}>
        <Segmented
          label="Speed"
          options={SPEEDS.map((s) => ({ value: String(s), label: speedLabel(s) }))}
          value={String(speed)}
          onChange={(v) => setSpeed(Number(v))}
          testID="voice-speed"
        />
      </View>
      {info !== undefined ? (
        <View style={{ marginTop: 10 }}>
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
          ) : downloaded ? (
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
                accessibilityLabel={`${book} is downloaded, ${chapters}, ${formatMB(here.bytes)}. More, Remove`}
                style={{ minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 12, paddingVertical: 12 }}
              >
                <View style={{ flex: 1, rowGap: 4 }}>
                  <Chrome tone="ink" style={{ fontWeight: "500" }}>
                    {`${book} is downloaded`}
                  </Chrome>
                  <RowNote>{`${chapters} · ${formatMB(here.bytes)}`}</RowNote>
                </View>
                <Icon name="more" size={20} tone="muted" />
              </View>
            </MenuView>
          ) : (
            // RD-34: the book for offline with its size, and Download.
            <View style={styles.row}>
              <View style={styles.text}>
                <Chrome tone="ink" style={{ fontWeight: "500" }}>
                  {`${book} for offline`}
                </Chrome>
                {/* LB-10: the size from the manifest; the voice it downloads is the one ticked above. */}
                <RowNote>{`${chapters} · ${formatMB(here.bytes)}`}</RowNote>
              </View>
              <Pill
                small
                title="Download"
                label={`Download ${book}, ${chapters}, ${formatMB(here.bytes)}`}
                // Success when the book the reader asked for lands on the open sheet; a warning only after
                // their own download failed (review §4). Play, pause and advancing never tick.
                onPress={() =>
                  void downloadBook(session.book, text).then((ok) => Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning))
                }
                testID="voice-download"
              />
            </View>
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
        </View>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  // `.row` in RD-34: 12 pt above and below, the sample, the name, the tick.
  row: { flexDirection: "row", alignItems: "center", columnGap: 12, minHeight: 44, paddingVertical: 12 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  choose: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", columnGap: 12 },
  text: { flex: 1, minWidth: 0, rowGap: 4 },
  pressed: { opacity: 0.72 },
});

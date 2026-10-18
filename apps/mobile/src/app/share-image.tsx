/**
 * Share as an image (PS-05, DR-18): a sheet with the verse drawn as a 300 pt square, the grounds under it (the day's
 * picture, white, dark), then Save to Photos and Share. What was saved or shared is listed under Saved › Images (PS-04).
 *
 * Reached from a selected verse's ⋯ (HM-02) and Saved › Images. Never for a licensed translation's words: the reader's
 * ⋯ does not offer it there (lib/reader.ts moreActions), and this sheet draws the BSB if one arrives anyway (rule 9).
 */

import { parseVerseId, verseOrd } from "@yada/schema";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Share, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { Pill } from "../components/Pill";
import { SheetScreen } from "../components/Sheet";
import { VerseImage } from "../components/VerseImage";
import { useAppData, useCore, useQuery } from "../data/AppData";
import { getTextsForOrds } from "../data/queries";
import { recordVerseImage } from "../data/user";
import { useLayout, usePalette } from "../design/tokens";
import { IMAGE_GROUNDS, type ImageGround, isImageGround } from "../lib/highlights";
import { chapterTitle, excerptOf } from "../lib/reader";
import { maySurfaceText } from "../lib/systemSurfaces";
import { dayOf, pictureDay } from "../lib/today";

/** The shared file: 1080 px square, what Instagram and Messages show without scaling. */
const PIXELS = 1080;

export default function ShareImage() {
  const params = useLocalSearchParams<{ verse: string; through?: string; translation?: string; ground?: string; day?: string }>();
  const palette = usePalette();
  const core = useCore();
  const { user } = useAppData();
  const { ax } = useLayout();
  const ref = parseVerseId(params.verse);
  const through = Math.max(Number(params.through ?? ref?.verse ?? 1), ref?.verse ?? 1);
  // An allow-list, as the system surfaces use (rule 9): an image leaves the app, so only an open text is drawn; any
  // other code, licensed or unknown, draws the BSB (security review, 18 Oct 2026).
  const translation = params.translation !== undefined && maySurfaceText(params.translation) ? params.translation : "BSB";
  const [ground, setGround] = useState<ImageGround>(isImageGround(params.ground) ? params.ground : "picture");
  const day = Number(params.day ?? pictureDay(dayOf(new Date())));
  const [busy, setBusy] = useState(false);
  const card = useRef<View>(null);

  const ords = ref === null ? [] : Array.from({ length: through - ref.verse + 1 }, (_, i) => verseOrd(ref.book, ref.chapter, ref.verse + i));
  const { data: texts } = useQuery(() => getTextsForOrds(core, ords, translation), [ords.join(","), translation]);
  if (ref === null) return null;
  const text = ords
    .map((ord, i) => {
      const words = excerptOf(texts?.get(ord) ?? "");
      return ords.length === 1 ? words : `${ref.verse + i} ${words}`;
    })
    .join(" ");
  // "Psalm 23:1", as Saved and the reader's header name a single psalm (lib/saved.ts verseLabel).
  const reference = `${chapterTitle(ref.book, ref.chapter)}:${ref.verse}${through > ref.verse ? `–${through}` : ""}`;
  const label = `${reference} · ${translation}`;

  // Named for the verse, so the share sheet and Files show "Psalm 90 4 BSB", not a UUID (simulator, 18 Oct 2026).
  const capture = () =>
    captureRef(card, { format: "png", quality: 1, width: PIXELS, height: PIXELS, result: "tmpfile", fileName: `${reference.replace(/[:–]/gu, " ")} ${translation}` });
  const remember = () =>
    recordVerseImage(user, { verse_id: params.verse, through, translation, ground, picture_day: day }).catch(() => undefined);

  const save = async () => {
    setBusy(true);
    try {
      const { granted } = await MediaLibrary.requestPermissionsAsync(true);
      if (!granted) return AccessibilityInfo.announceForAccessibility("Yada can’t save to Photos. Allow it in Settings.");
      await MediaLibrary.saveToLibraryAsync(await capture());
      await remember();
      AccessibilityInfo.announceForAccessibility("Saved to Photos");
    } catch {
      // A failed capture or Photos write said nothing at all (code review, 18 Oct 2026).
      AccessibilityInfo.announceForAccessibility("Couldn’t save the image");
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    setBusy(true);
    try {
      const result = await Share.share({ url: await capture() });
      if (result.action === Share.sharedAction) await remember();
    } catch {
      AccessibilityInfo.announceForAccessibility("Couldn’t share");
    } finally {
      setBusy(false);
    }
  };

  const groundName: Record<ImageGround, string> = { picture: "The day’s picture", evening: "The evening’s picture", white: "White", dark: "Dark" };

  return (
    <SheetScreen title="Share as an image" subtitle={reference} backLabel={null} footer={false} noBack testID="share-image">
      <View style={styles.center}>
        <VerseImage ref={card} text={text} label={label} ground={ground} pictureDay={day} size={300} />
      </View>
      <View style={styles.grounds} accessibilityRole="radiogroup" accessibilityLabel="Background">
        {IMAGE_GROUNDS.map((g) => {
          const on = g === ground;
          return (
            <Pressable
              key={g}
              onPress={() => setGround(g)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={groundName[g]}
              style={[styles.ground, { borderColor: on ? palette.ink : "transparent" }]}
              testID={`share-ground-${g}`}
            >
              <VerseImage text="" label="" ground={g} pictureDay={day} size={44} />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.actions, ax ? { flexDirection: "column" } : null]}>
        <Pill title="Save to Photos" onPress={() => void save()} disabled={busy || text === ""} grow testID="share-save" />
        <Pill title="Share" onPress={() => void share()} primary disabled={busy || text === ""} grow testID="share-share" />
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
  grounds: { flexDirection: "row", justifyContent: "center", columnGap: 10, marginTop: 16 },
  // A 3 pt ring around the chosen ground (the canvas's `.on`, box-shadow 0 0 0 3px ink).
  ground: { borderWidth: 3, borderRadius: 14, padding: 2 },
  actions: { flexDirection: "row", columnGap: 10, rowGap: 10, marginTop: 20 },
});

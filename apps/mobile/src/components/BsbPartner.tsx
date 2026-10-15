/**
 * MM-03 and MS-01 in the verse: the BSB words a tapped Greek or Hebrew word translates, underlined with
 * the evidence mark (PG-10: semibold, dotted accent underline; canvas WM-01), and the places the data
 * knows, in accent ink, each opening its map (WM-07). Pattern: Brink marks one word inside running
 * text, https://mobbin.com/screens/e6c90cf6-9194-46bc-8b76-a0112d7b3a85.
 *
 * Only under the BSB text the links were built on (lib/wordsAndPlaces.ts partnerIn): on any other
 * translation the verse shows exactly as before (rule 4).
 */

import type { BookCode } from "@yada/schema";
import { router } from "expo-router";
import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

import { useAppData, useQuery } from "../data/AppData";
import { loadSettings, saveSetting } from "../data/user";
import { loadVersePlaces, loadWordLinks } from "../data/wordsAndPlaces";
import { usePalette } from "../design/tokens";
import { useReduceMotion } from "../lib/motion";
import { partnerIn, partnerLabel, pieces } from "../lib/wordsAndPlaces";
import { partnerPosition, usePartner } from "../state/partner";
import { useSheetBase } from "./navigation";
import { Section } from "./Sheet";
import { Scripture } from "./Type";

/** PG-10's evidence mark, as components/Verse.tsx draws it. */
function useEvidenceMark() {
  const palette = usePalette();
  return { fontWeight: "600", textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: palette.accent } as const;
}

export interface VerseMarks {
  /** The verse's text with its marks, to sit inside the verse's own Scripture. */
  readonly text: ReactNode;
  /** Appended to the verse's VoiceOver label: ". In the BSB: Word". */
  readonly label: string;
  /** The hairline under the verse, the first time on this phone (WM-01). */
  readonly join: ReactNode;
}

/**
 * For Understand's verse at the top of the sheet. Clears the tapped word when the sheet closes, so the
 * next verse opens unmarked.
 */
export function useVerseMarks(book: BookCode, ord: number, shown: string): VerseMarks {
  const palette = usePalette();
  const base = useSheetBase();
  const mark = useEvidenceMark();
  const word = usePartner((s) => s.word);
  const position = partnerPosition(word, ord);
  const { data } = useQuery(async () => {
    const [links, places] = await Promise.all([loadWordLinks(book, ord), loadVersePlaces(book, ord)]);
    return { links, places };
  }, [book, ord]);
  useEffect(() => () => usePartner.getState().setWord(null), []);

  const links = data?.links ?? null;
  const partner = partnerIn(shown, links, position);
  // Place spans index the BSB too: marked only when the text shown is that BSB.
  const places = links !== null && shown === links.bsb ? (data?.places ?? []).filter((p) => p.spans.length > 0) : [];
  const parts = pieces(shown, partner, places);
  const text = parts.map((p, i) =>
    p.mark === "partner" ? (
      <Text key={i} style={mark}>
        {p.text}
      </Text>
    ) : p.mark === "place" && p.place !== undefined ? (
      <Text
        key={i}
        accessibilityRole="link"
        accessibilityHint="Opens its map"
        onPress={() => router.push({ pathname: `${base}/place`, params: { book, id: p.place, from: String(ord) } })}
        style={{ color: palette.accent, fontWeight: "600" }}
        testID={`place-${p.text}`}
      >
        {p.text}
      </Text>
    ) : (
      p.text
    ),
  );
  return { text, label: partner === null ? "" : `. ${partnerLabel(shown, partner)}`, join: partner === null ? null : <PartnerJoin key={word ?? ""} /> };
}

/**
 * MM-03's hairline: a 1 pt line under the verse, there for half a second, once per phone. Reduce Motion:
 * never (the underline alone carries it).
 */
function PartnerJoin() {
  const palette = usePalette();
  const { user } = useAppData();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const { data: first } = useQuery(async () => {
    const seen = (await loadSettings(user))["partnerJoinSeen"] === "1";
    if (!seen) void saveSetting(user, "partnerJoinSeen", "1");
    return !seen;
  }, []);
  useEffect(() => {
    if (first !== true || reduceMotion) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0.4, duration: 120, useNativeDriver: true }),
      Animated.delay(260),
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [first, reduceMotion, opacity]);
  if (first !== true || reduceMotion) return null;
  return <Animated.View aria-hidden importantForAccessibility="no-hide-descendants" style={{ opacity, width: 1, height: 18, marginLeft: "40%", marginTop: -14, marginBottom: 4, backgroundColor: palette.ink }} />;
}

/**
 * The word card's "In the BSB" (WM-02): the verse with this word's partner underlined. Nothing at all when
 * the reader is not reading the BSB, or the word has no English of its own (WM-04).
 */
export function InTheBsb({ book, ord, position, reading }: { book: BookCode; ord: number; position: number; reading: boolean }) {
  const mark = useEvidenceMark();
  const { data } = useQuery(() => (reading ? loadWordLinks(book, ord) : Promise.resolve(null)), [book, ord, reading]);
  const links = data ?? null;
  if (links === null) return null;
  const partner = partnerIn(links.bsb, links, position);
  if (partner === null) return null;
  return (
    <Section title="In the BSB">
      <View accessible accessibilityLabel={`${partnerLabel(links.bsb, partner)}. ${links.bsb}`} testID="in-the-bsb">
        <Scripture step="claim">
          {pieces(links.bsb, partner, []).map((p, i) =>
            p.mark === "partner" ? (
              <Text key={i} style={mark}>
                {p.text}
              </Text>
            ) : (
              p.text
            ),
          )}
        </Scripture>
      </View>
    </Section>
  );
}

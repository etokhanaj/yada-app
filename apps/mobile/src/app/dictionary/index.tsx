/**
 * DI-30: the dictionary from Search. Find a word filters as you type, across all three groups; otherwise Key words,
 * People and places and More words as pills, the group whole under its letters, each word with its own first
 * sentence. The A to Z rail scrolls to a letter (iOS Contacts' index); VoiceOver adjusts it as one control, a swipe
 * up or down a letter. At AX sizes the rail goes, as the frame drew it.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { type GestureResponderEvent, type ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterPills } from "../../components/FilterPills";
import { Icon } from "../../components/Icon";
import { ListRow, PageScreen } from "../../components/Page";
import { SourceLine } from "../../components/SourceLine";
import { Chrome } from "../../components/Type";
import type { DictionaryKind } from "../../data/dictionary.generated";
import { useLayout, usePalette } from "../../design/tokens";
import { useReduceMotion } from "../../lib/motion";
import { DICTIONARY_CREDIT, DICTIONARY_GROUPS, type DictionaryWord, dictionaryWords, filterWords } from "../../lib/dictionary";

export default function DictionaryScreen() {
  const params = useLocalSearchParams<{ back?: string }>();
  const palette = usePalette();
  const { ax, sectionGap } = useLayout();
  const words = useMemo(() => dictionaryWords(), []);
  const [kind, setKind] = useState<DictionaryKind>("kt");
  const [input, setInput] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const contentTop = useRef<number | null>(null);
  const heads = useRef(new Map<string, number>());
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();

  const query = input.trim();
  const group = useMemo(() => words.filter((w) => w.kind === kind), [words, kind]);
  const letters = useMemo(() => [...new Set(group.map((w) => w.letter))], [group]);
  const found = useMemo(() => (query === "" ? [] : filterWords(query, words)), [query, words]);
  const railed = !ax && query === "";

  // A letter's heading sits at the words' top in the scroll (read once, at mount, before any scroll; the ScrollView
  // starts at the window's top under PageScreen's floating bar) plus its own onLayout y; it lands under the bar
  // (top inset + 60 pt), not behind it.
  const scrollToLetter = (l: string) => {
    setLetter(l);
    const y = heads.current.get(l);
    if (y === undefined || contentTop.current === null) return;
    scroll.current?.scrollTo({ y: Math.max(0, contentTop.current + y - insets.top - 60), animated: !reduceMotion });
  };

  const open = (term: string) => router.push({ pathname: "/dictionary/term", params: { term, back: "Dictionary" } });
  const rows = (list: readonly DictionaryWord[]) =>
    list.map((w, i) => (
      <ListRow
        key={w.term}
        first={i === 0}
        chevron={false}
        title={<Chrome tone="ink" style={{ fontWeight: "500" }}>{w.term}</Chrome>}
        subtitle={
          <Chrome step="note" tone="muted" numberOfLines={ax ? undefined : 2}>
            {w.first}
          </Chrome>
        }
        label={`${w.term}. ${w.first}`}
        onPress={() => open(w.term)}
        testID={`dictionary-${w.term}`}
      />
    ));
  const byLetter = (list: readonly DictionaryWord[]) =>
    [...new Set(list.map((w) => w.letter))].map((l, i) => (
      <View key={l} style={{ marginTop: i === 0 ? 0 : sectionGap / 2 }} onLayout={(e) => heads.current.set(l, e.nativeEvent.layout.y)}>
        <LetterHead letter={l} />
        {rows(list.filter((w) => w.letter === l))}
      </View>
    ));

  return (
    <View style={{ flex: 1 }}>
      <PageScreen title="Dictionary" back={params.back ?? "Search"} scrollRef={scroll} testID="dictionary">
        {/* The rail sits over the page's right edge; the words keep clear of it (DI-30's 28 pt). */}
        <View
          ref={content}
          onLayout={() => {
            if (contentTop.current === null) content.current?.measureInWindow((_x, y) => (contentTop.current = y));
          }}
          style={{ paddingRight: railed ? 14 : 0 }}
        >
          <View style={[styles.field, { backgroundColor: palette.fill, minHeight: ax ? 64 : 48 }]}>
            <Icon name="search" size={18} tone="muted" />
            <TextInput
              value={input}
              onChangeText={setInput}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
              placeholder="Find a word"
              placeholderTextColor={palette.mutedInk}
              maxFontSizeMultiplier={2}
              accessibilityLabel="Find a word"
              style={[styles.input, { color: palette.ink }]}
              testID="dictionary-field"
            />
          </View>
          {query !== "" ? (
            found.length === 0 ? (
              <Chrome tone="muted" style={{ marginTop: 8 }}>{`No word matches “${query}”`}</Chrome>
            ) : (
              rows(found)
            )
          ) : (
            <>
              <View style={{ marginBottom: 14 }}>
                <FilterPills
                  options={DICTIONARY_GROUPS.map((g) => ({ key: g.kind, title: g.title }))}
                  chosen={kind}
                  onChoose={(k) => {
                    setKind(k);
                    setLetter(null);
                  }}
                  testID="dictionary-groups"
                />
              </View>
              {byLetter(group)}
            </>
          )}
          <SourceLine style={{ marginTop: sectionGap }}>{DICTIONARY_CREDIT}</SourceLine>
        </View>
      </PageScreen>
      {railed ? (
        <View pointerEvents="box-none" style={styles.railBox}>
          <Rail letters={letters} chosen={letter !== null && letters.includes(letter) ? letter : (letters[0] ?? "A")} onChoose={scrollToLetter} />
        </View>
      ) : null}
    </View>
  );
}

function LetterHead({ letter }: { letter: string }) {
  return (
    <Chrome step="note" tone="muted" accessibilityRole="header" style={{ fontWeight: "600", marginBottom: 2 }}>
      {letter}
    </Chrome>
  );
}

/** The A to Z rail: tap or drag along it. One adjustable control to VoiceOver, its value the letter shown. */
function Rail({ letters, chosen, onChoose }: { letters: readonly string[]; chosen: string; onChoose: (letter: string) => void }) {
  const rail = useRef<View>(null);
  const frame = useRef({ top: 0, height: 1 });
  const at = letters.indexOf(chosen);
  const pick = (e: GestureResponderEvent) => {
    const { top, height } = frame.current;
    const i = Math.min(letters.length - 1, Math.max(0, Math.floor(((e.nativeEvent.pageY - top) / height) * letters.length)));
    const l = letters[i];
    if (l !== undefined && l !== chosen) onChoose(l);
  };
  const step = (by: number) => {
    const l = letters[at + by];
    if (l !== undefined) onChoose(l);
  };
  return (
    <View
      ref={rail}
      onLayout={() => rail.current?.measureInWindow((_x, y, _w, h) => (frame.current = { top: y, height: Math.max(h, 1) }))}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Letter"
      accessibilityValue={{ text: chosen }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
      hitSlop={{ left: 16, right: 8 }}
      style={styles.rail}
      testID="dictionary-rail"
    >
      {letters.map((l) => (
        <Chrome key={l} step="label" tone="accent" size={11} maxFontSizeMultiplier={1} style={styles.letter}>
          {l}
        </Chrome>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", columnGap: 10, borderRadius: 24, paddingHorizontal: 16, marginBottom: 12 },
  input: { flex: 1, fontSize: 17, paddingVertical: 10 },
  // Centred below the title, field and group pills, which it overlapped at the top of the page (12f QA).
  railBox: { position: "absolute", top: 300, bottom: 40, right: 2, justifyContent: "center" },
  rail: { paddingVertical: 6, paddingHorizontal: 4, rowGap: 1 },
  letter: { textAlign: "center", fontWeight: "600" },
});

/**
 * Grammar terms in plain words (build 6 item H; canvas IG-03–05). Under the word's Form line, each term
 * it names that the grammar table explains (tense, voice, mood, case; stem, conjugation, state) is a row;
 * tapping one opens that one sentence in place with its credit, tapping again closes it. Splitwise sets a
 * term beside its one-line meaning, https://mobbin.com/screens/7499140f-c314-49f3-873a-f390c11148a7; Wise
 * opens a term's explanation where it is, https://mobbin.com/screens/b884dc4c-2841-4399-827c-2b27a21662a7.
 *
 * The sentences are the unfoldingWord grammars' own, or for six Greek terms Machen's (decision 23), each
 * credited as its own; only those John approved ship (rule 2;
 * data/grammar.generated.ts). A term with no approved sentence has no row: nothing is said that the
 * source does not say (rule 4). Opening is instant, so there is no motion to reduce.
 */

import { grammarKey, morphTerms } from "@yada/schema";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { GRAMMAR_CREDITS, GRAMMAR_ENTRY_CREDITS, GRAMMAR_SENTENCES } from "../data/grammar.generated";
import { SourceLine } from "./SourceLine";
import { usePalette } from "../design/tokens";
import { Icon } from "./Icon";
import { Chrome, Prose } from "./Type";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function GrammarTerms({ morph }: { morph: string }) {
  const palette = usePalette();
  const [open, setOpen] = useState<string | null>(null);
  const terms = morphTerms(morph).flatMap((t) => {
    const sentence = GRAMMAR_SENTENCES[grammarKey(t)];
    return sentence === undefined ? [] : [{ ...t, key: grammarKey(t), sentence }];
  });
  if (terms.length === 0) return null;
  return (
    <View style={{ marginTop: 8 }} testID="grammar-terms">
      {terms.map((t, index) => {
        const expanded = open === t.key;
        return (
          <View key={t.key}>
            <Pressable
              onPress={() => setOpen(expanded ? null : t.key)}
              accessibilityRole="button"
              accessibilityLabel={`${capitalise(t.label)}, what it means`}
              accessibilityState={{ expanded }}
              testID={`grammar-term-${t.label.replace(/ /g, "-")}`}
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "center", columnGap: 12, minHeight: 52, paddingVertical: 12 },
                index > 0 ? { boxShadow: `0 -1px 0 ${palette.divider}` } : null,
                pressed ? { backgroundColor: palette.fill } : null,
              ]}
            >
              <Chrome tone="ink" style={{ flex: 1 }}>
                {capitalise(t.label)}
              </Chrome>
              <Icon name={expanded ? "up" : "down"} size={16} tone="muted" />
            </Pressable>
            {expanded ? (
              <View style={{ paddingBottom: 14 }} testID="grammar-sentence">
                <Prose step="claim">{t.sentence}</Prose>
                <SourceLine style={{ marginTop: 6 }}>{GRAMMAR_ENTRY_CREDITS[t.key] ?? GRAMMAR_CREDITS[t.language]}</SourceLine>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

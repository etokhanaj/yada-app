/**
 * DI-04: browse the dictionary from Search's empty state, grouped, no tab of its own. Key words, People and places,
 * and Other words, each with its count, four terms and Show all; the credit once at the foot.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { ListRow, PageScreen } from "../../components/Page";
import { TextLink } from "../../components/Sheet";
import { SourceLine } from "../../components/SourceLine";
import { SectionTitle } from "../../components/Type";
import { useLayout } from "../../design/tokens";
import { DICTIONARY_CREDIT, groupDictionary } from "../../lib/dictionary";

const SHOWN = 4;

export default function DictionaryScreen() {
  const params = useLocalSearchParams<{ back?: string }>();
  const { sectionGap } = useLayout();
  const groups = useMemo(() => groupDictionary(), []);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  return (
    <PageScreen title="Dictionary" back={params.back ?? "Search"} testID="dictionary">
      {groups.map((group, gi) => {
        const all = open.has(group.kind);
        return (
          <View key={group.kind} style={{ marginTop: gi === 0 ? 0 : sectionGap }}>
            <SectionTitle style={{ marginBottom: 6 }}>{`${group.title} · ${group.terms.length}`}</SectionTitle>
            {(all ? group.terms : group.terms.slice(0, SHOWN)).map((term, i) => (
              <ListRow
                key={term}
                first={i === 0}
                title={term}
                onPress={() => router.push({ pathname: "/dictionary/term", params: { term, back: "Dictionary" } })}
                testID={`dictionary-${term}`}
              />
            ))}
            {!all && group.terms.length > SHOWN ? (
              <TextLink
                label={`Show all ${group.terms.length}`}
                a11yLabel={`Show all ${group.terms.length} ${group.title.toLowerCase()}`}
                onPress={() => setOpen((s) => new Set(s).add(group.kind))}
                testID={`dictionary-all-${group.kind}`}
              />
            ) : null}
          </View>
        );
      })}
      <SourceLine style={{ marginTop: sectionGap }}>{DICTIONARY_CREDIT}</SourceLine>
    </PageScreen>
  );
}

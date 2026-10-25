/**
 * Choose a verse (SW-02): a sheet over Sit's setup. Search first (a reference or words, as Search takes them), then
 * Today, Saved, For when you're and Recent as filter pills. Saved opens first when there is anything saved, as the
 * frame draws it; else Today. Each row's Sit pill, or the row itself, hands its verse back to the setup.
 */

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { EmptyState } from "../../components/EmptyState";
import { FilterPills } from "../../components/FilterPills";
import { Icon } from "../../components/Icon";
import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { useAppData, useCore, useQuery } from "../../data/AppData";
import { moodRows, recentRows, savedRows, type SitRow, searchRows, todayRows } from "../../data/sitChoices";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { SIT_FILTERS, type SitFilter } from "../../lib/sitChoices";
import { useSitChoice } from "../../state/sit";
import { useSettings } from "../../state/settings";

export default function ChooseVerse() {
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const palette = usePalette();
  const { ax } = useLayout();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SitFilter | null>(null);

  // Typing settles for a moment before it searches, as Search does.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const { data: saved } = useQuery(() => savedRows(core, user, translation), [translation]);
  const shown: SitFilter = filter ?? (saved !== undefined && saved.length > 0 ? "saved" : "today");
  const { data: rows } = useQuery(async (): Promise<SitRow[]> => {
    if (query !== "") return searchRows(core, translation, query);
    if (shown === "saved") return saved ?? [];
    if (shown === "moods") return moodRows(core, translation);
    if (shown === "recent") return recentRows(core, user, translation);
    return todayRows(core, translation);
  }, [query, shown, translation, saved?.length ?? -1]);

  const pick = (row: SitRow) => {
    useSitChoice.getState().choose(row.verse);
    router.back();
  };

  return (
    <SheetScreen title="Choose a verse" backLabel={null} noBack footer={false} keyboard testID="sit-choose">
      <View style={[styles.field, { backgroundColor: palette.fill, minHeight: ax ? 64 : 48 }]}>
        <Icon name="search" size={18} tone="muted" />
        <TextInput
          value={input}
          onChangeText={setInput}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          onSubmitEditing={() => setQuery(input.trim())}
          placeholder="A verse, a word or a reference"
          placeholderTextColor={palette.mutedInk}
          maxFontSizeMultiplier={2}
          accessibilityLabel="Find a verse"
          style={[styles.input, { color: palette.ink }]}
          testID="sit-choose-field"
        />
      </View>
      {query === "" ? <FilterPills options={SIT_FILTERS} chosen={shown} onChoose={setFilter} testID="sit-filter" /> : null}
      <View style={{ marginTop: 10 }}>
        {rows === undefined ? null : rows.length === 0 ? (
          query !== "" ? (
            <Chrome tone="muted" style={{ marginTop: 16 }}>{`Nothing to sit with matches “${query}”.`}</Chrome>
          ) : shown === "saved" || shown === "recent" ? (
            <EmptyState
              title={shown === "saved" ? "Nothing saved yet" : "Nothing explored yet"}
              line={shown === "saved" ? "Verses you highlight, bookmark or note show here." : "Verses you look into show here."}
              action="Today’s verse"
              onAction={() => setFilter("today")}
            />
          ) : null
        ) : (
          rows.map((row, i) => (
            <ListRow
              key={`${row.verse.place}-${row.why ?? ""}-${i}`}
              first={i === 0}
              title={
                <Chrome tone="ink" numberOfLines={2} style={{ fontFamily: FONTS.scripture, fontWeight: "400" }}>
                  {row.verse.text}
                </Chrome>
              }
              subtitle={
                <View style={styles.meta}>
                  {row.color === null ? null : <View style={[styles.swatch, { backgroundColor: palette.swatches[row.color], borderColor: palette.divider }]} />}
                  <Chrome step="note" tone="muted" style={{ flexShrink: 1 }}>
                    {[row.verse.ref, row.why].filter((x) => x !== null).join(" · ")}
                  </Chrome>
                </View>
              }
              onPress={() => pick(row)}
              label={`${row.verse.ref}. ${row.verse.text}`}
              action={{ title: "Sit", label: `Sit with ${row.verse.ref}`, onPress: () => pick(row) }}
              testID={`sit-choice-${i}`}
            />
          ))
        )}
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", columnGap: 10, borderRadius: 24, paddingHorizontal: 16, marginTop: 4, marginBottom: 12 },
  input: { flex: 1, fontSize: 17, paddingVertical: 10 },
  meta: { flexDirection: "row", alignItems: "center", columnGap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
});

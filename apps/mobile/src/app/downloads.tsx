/**
 * Downloads (canvas ST-02, DN-05): what is on this iPhone and its size, by kind; ⋯ on a row removes it
 * (one action, as the Voice sheet's book, BA-07). Understand is listed per book, readings per voice and
 * book, study notes as one row. Built-in texts are part of Yada: one line says so, and they never appear.
 */

import { MenuView } from "@react-native-menu/menu";
import { BOOK_CODES, isBookCode } from "@yada/schema";
import { useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { Alert, View } from "react-native";

import { Icon } from "../components/Icon";
import { ListRow, PageScreen } from "../components/Page";
import { SectionTitle, Chrome } from "../components/Type";
import { useAppData } from "../data/AppData";
import { readingsOnPhone, removeBook } from "../data/recordings";
import { removeAllDownloads } from "../data/removeData";
import { removeStudy, useStudy } from "../data/study";
import { removeTranslation, useTranslations } from "../data/translations";
import { removeUnderstand, useUnderstand } from "../data/understand";
import { useLayout } from "../design/tokens";
import { formatMB } from "../lib/progress";

const NAMES: Record<string, string> = { heart: "Heart", george: "George" };

export default function DownloadsScreen() {
  const { user } = useAppData();
  const { sectionGap } = useLayout();
  const translations = useTranslations((s) => s.installed);
  const study = useStudy((s) => s.installed);
  const understand = useUnderstand((s) => s.installed);
  const [readings, setReadings] = useState(readingsOnPhone());
  useFocusEffect(useCallback(() => setReadings(readingsOnPhone()), []));

  // Narrowed here, so the rows below need no cast.
  const onPhone = (files: typeof understand) =>
    Object.values(files).flatMap((f) => (f === undefined || f.shipped === true || !isBookCode(f.book) ? [] : [{ book: f.book, bytes: f.bytes }]));
  const understandBooks = onPhone(understand);
  const studyBooks = onPhone(study);
  const studyBytes = studyBooks.reduce((n, f) => n + f.bytes, 0);
  const nothing = understandBooks.length === 0 && readings.length === 0 && translations.length === 0 && studyBooks.length === 0;

  /** A row with its size and ⋯ → Remove. */
  const row = (key: string, first: boolean, title: string, size: string, remove: () => void, testID: string): ReactNode => (
    <MenuView key={key} shouldOpenOnLongPress={false} actions={[{ id: "remove", title: `Remove ${title}`, attributes: { destructive: true } }]} onPressAction={remove} testID={testID}>
      <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel={`${title}, ${size}. Remove`}>
        <ListRow first={first} title={title} subtitle={size} chevron={false} right={<Icon name="more" size={20} tone="muted" />} />
      </View>
    </MenuView>
  );

  const group = (title: string, rows: ReactNode[]) =>
    rows.length === 0 ? null : (
      <View style={{ marginBottom: sectionGap }}>
        <SectionTitle style={{ marginBottom: 6 }}>{title}</SectionTitle>
        {rows}
      </View>
    );

  return (
    <PageScreen title="Downloads" back="Settings" testID="downloads">
      {group(
        "Understand",
        understandBooks.map((f, i) => row(`u-${f.book}`, i === 0, BOOK_CODES[f.book].name, formatMB(f.bytes), () => void removeUnderstand(user, f.book), `downloads-understand-${f.book}`)),
      )}
      {group(
        "Readings",
        readings.map((r, i) =>
          // LB-11: each reading by book, voice and text, "John · Heart · WEB".
          row(`r-${r.narrator}-${r.text}-${r.book}`, i === 0, `${BOOK_CODES[r.book].name} · ${NAMES[r.narrator] ?? r.narrator} · ${r.text}`, `${r.chapters} ${r.chapters === 1 ? "chapter" : "chapters"} · ${formatMB(r.bytes)}`, () => {
            removeBook(r.book, r.narrator, r.text);
            setReadings(readingsOnPhone());
          }, `downloads-reading-${r.narrator}-${r.text}-${r.book}`),
        ),
      )}
      {group(
        "Translations",
        translations.map((t, i) => row(`t-${t.code}`, i === 0, t.name, formatMB(t.bytes), () => void removeTranslation(user, t.code), `downloads-translation-${t.code}`)),
      )}
      {group(
        "Study notes",
        studyBooks.length === 0
          ? []
          : [
              row("study", true, `${studyBooks.length} ${studyBooks.length === 1 ? "book" : "books"}`, formatMB(studyBytes), () => {
                for (const f of studyBooks) void removeStudy(user, f.book);
              }, "downloads-study"),
            ],
      )}
      {nothing ? (
        <Chrome step="note" tone="muted" style={{ marginBottom: 12 }}>
          Nothing downloaded.
        </Chrome>
      ) : null}
      <Chrome step="note" tone="muted">
        Built-in texts are part of Yada and can’t be removed.
      </Chrome>
      {nothing ? null : (
        <View style={{ marginTop: sectionGap }}>
          <ListRow
            first
            chevron={false}
            title="Remove all downloads"
            onPress={() =>
              Alert.alert("Remove all downloads?", "Understand, readings, translations and study notes will be removed from this iPhone. You can download them again.", [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => void removeAllDownloads(user).then(() => setReadings(readingsOnPhone())) },
              ])
            }
            testID="downloads-remove-all"
          />
        </View>
      )}
    </PageScreen>
  );
}

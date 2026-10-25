/**
 * Saved (PS-04, redrawn as Build 12 SA-30): what the reader kept, from You. Highlights · Notes · Bookmarks · Images as
 * filter pills; highlights and bookmarks grouped by chapter with a count, each verse in Literata under its reference,
 * a highlight drawn as the reader draws it, a tint on the words (palette.highlights), not a bar beside them. The
 * colour is never the only mark: VoiceOver hears it, and the reference and words are there. Your reading left with
 * Your rhythm: the days live on You now. ⋯ keeps Edit and Export, which SA-30 does not draw but nothing else offers.
 * It replaced Bookmarks (B-01, B-02), whose rows and removal it keeps.
 *
 * Removal is Edit in ⋯, as iOS lists do, plus a VoiceOver action on each row (brief §5 Gestures). One muted line
 * says where all this is kept (IC-01), true signed in or out (data/cloud.ts cloudAvailable).
 */

import { MenuView } from "@react-native-menu/menu";
import { parseVerseId, type VerseRef, verseOrd } from "@yada/schema";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { type AccessibilityActionEvent, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { prayCloud } from "../../modules/yada-pray";
import { GlassButton } from "../components/Glass";
import { Icon } from "../components/Icon";
import { readerHref } from "../components/navigation";
import { FilterPills } from "../components/FilterPills";
import { ListRow, PageScreen } from "../components/Page";
import { Chrome, Scripture, SectionTitle } from "../components/Type";
import { DivineText } from "../components/Verse";
import { VerseImage } from "../components/VerseImage";
import { useAppData, useCore, useQuery } from "../data/AppData";
import { cloudAvailable } from "../data/cloud";
import { isLicensedCode } from "../data/licensed";
import { getTextsForOrds } from "../data/queries";
import {
  listBookmarks,
  listHighlights,
  listNotes,
  listVerseImages,
  removeBookmark,
  removeVerseImage,
  saveNote,
  setHighlight,
  subscribeYourSpace,
  type VerseImage as SavedImage,
} from "../data/user";
import { FONTS, useLayout, usePalette } from "../design/tokens";
import { parseChapterKey } from "../lib/chaptersRead";
import { type HighlightColor, highlightSpoken } from "../lib/highlights";
import { chapterTitle, excerptOf } from "../lib/reader";
import { verseLabel } from "../lib/saved";
import { useSettings } from "../state/settings";

type Tab = "highlights" | "notes" | "bookmarks" | "images";

const TABS: ReadonlyArray<{ key: Tab; title: string }> = [
  { key: "highlights", title: "Highlights" },
  { key: "notes", title: "Notes" },
  { key: "bookmarks", title: "Bookmarks" },
  { key: "images", title: "Images" },
];

const EMPTY: Record<Tab, [string, string]> = {
  highlights: ["No highlights yet.", "Tap a verse, then a colour."],
  notes: ["No notes yet.", "Tap a verse, then Note."],
  bookmarks: ["No bookmarks yet.", "Tap a verse, then ⋯ › Bookmark."],
  images: ["No images yet.", "Tap a verse, then ⋯ › Share as an image."],
};

interface Lists {
  highlights: Array<{ verse_id: string; color: HighlightColor }>;
  notes: Array<{ target: string; body: string }>;
  bookmarks: string[];
  images: SavedImage[];
}

/** SA-30: verses grouped by chapter, in Bible order, so a chapter's highlights sit together under it. */
function byChapter<T>(items: readonly T[], idOf: (item: T) => string): Array<{ key: string; title: string; items: Array<{ item: T; ref: VerseRef }> }> {
  const placed = items.flatMap((item) => {
    const ref = parseVerseId(idOf(item));
    return ref === null ? [] : [{ item, ref, ord: verseOrd(ref.book, ref.chapter, ref.verse) }];
  });
  placed.sort((a, b) => a.ord - b.ord);
  const groups: Array<{ key: string; title: string; items: Array<{ item: T; ref: VerseRef }> }> = [];
  for (const { item, ref } of placed) {
    const key = `${ref.book}.${ref.chapter}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push({ item, ref });
    else groups.push({ key, title: chapterTitle(ref.book, ref.chapter), items: [{ item, ref }] });
  }
  return groups;
}

export default function SavedScreen() {
  const palette = usePalette();
  const core = useCore();
  const { user } = useAppData();
  const { ax, control, sectionGap } = useLayout();
  // IC-02: CloudKit's account status, which Pray's container entitlement now allows (build 8), says when no one is
  // signed in to iCloud. Only that answer changes the line: iCloud Drive off, restricted or unknown keep the general
  // one, because the key-value store can still sync then (data/cloud.ts cloudAvailable).
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    void prayCloud
      ?.accountStatus()
      .then((s) => setSignedOut(s === "noAccount"))
      .catch(() => undefined);
  }, []);
  const translation = useSettings((s) => s.translation);
  // The iPad sidebar opens Saved on Highlights or Notes, and names the tab it came from (TB-01 `.sbi.sm`).
  const params = useLocalSearchParams<{ tab?: string; back?: string }>();
  const [tab, setTab] = useState<Tab>(() => TABS.find((t) => t.key === params.tab)?.key ?? "highlights");
  const [lists, setLists] = useState<Lists | null>(null);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(() => {
    void Promise.all([listHighlights(user), listNotes(user), listBookmarks(user), listVerseImages(user)]).then(([highlights, notes, bookmarks, images]) =>
      setLists({ highlights, notes, bookmarks: bookmarks.map((b) => b.verse_id), images }),
    );
  }, [user]);
  useFocusEffect(reload);
  // A note edited in its sheet over Saved never blurs this page.
  useEffect(() => subscribeYourSpace(reload), [reload]);

  // US-11: a licensed version is not on the phone, so an excerpt is the BSB's, labelled as such.
  const shown = isLicensedCode(translation) ? "BSB" : translation;
  const verseIds = lists === null ? [] : [...lists.highlights.map((h) => h.verse_id), ...lists.bookmarks];
  const ords = verseIds.flatMap((id) => {
    const ref = parseVerseId(id);
    return ref === null ? [] : [verseOrd(ref.book, ref.chapter, ref.verse)];
  });
  // Each image is read in the version it was made in, so its words match the label and the card (code review,
  // 18 Oct 2026); a licensed one is the BSB's, as the share sheet made it (US-11).
  const imageCode = (image: SavedImage) => (isLicensedCode(image.translation) ? "BSB" : image.translation);
  const imageOrds = new Map<string, number[]>();
  for (const image of lists?.images ?? []) {
    const ref = parseVerseId(image.verse_id);
    if (ref === null) continue;
    const code = imageCode(image);
    const list = imageOrds.get(code) ?? [];
    for (let v = ref.verse; v <= image.through; v++) list.push(verseOrd(ref.book, ref.chapter, v));
    imageOrds.set(code, list);
  }
  const imageKey = [...imageOrds].map(([code, list]) => `${code}:${list.join(",")}`).join(";");
  const { data: texts } = useQuery(() => getTextsForOrds(core, ords, shown), [ords.join(","), shown]);
  const { data: imageTexts } = useQuery(
    async () => new Map(await Promise.all([...imageOrds].map(async ([code, list]) => [code, await getTextsForOrds(core, list, code)] as const))),
    [imageKey],
  );

  const openVerse = (ref: VerseRef) => router.push(readerHref({ book: ref.book, chapter: ref.chapter, verse: ref.verse, select: true, back: "Saved" }));
  const excerptFor = (ref: VerseRef) => excerptOf(texts?.get(verseOrd(ref.book, ref.chapter, ref.verse)) ?? "");
  // SA-30 names the verse alone; the version is said only when it is not the reader's own (US-11's BSB).
  const labelFor = (ref: VerseRef) => (shown === translation ? verseLabel(ref) : `${verseLabel(ref)} · ${shown}`);

  /** One element to VoiceOver with Remove on it; touches still reach the row and its control. */
  const removable = (key: string, label: string, onOpen: () => void, onRemove: () => void, first: boolean, children: ReactNode, overline?: string) => (
    <View
      key={key}
      testID={`saved-${key}`}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: "activate" }, { name: "remove", label: "Remove" }]}
      onAccessibilityAction={(e: AccessibilityActionEvent) => (e.nativeEvent.actionName === "remove" ? onRemove() : onOpen())}
    >
      <ListRow
        first={first}
        overline={overline}
        onPress={editing ? undefined : onOpen}
        // SA-30 draws the rows bare: the whole row opens the verse.
        chevron={false}
        right={
          editing ? (
            <Pressable
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel="Remove"
              style={({ pressed }) => [styles.remove, { width: control, height: control, backgroundColor: pressed ? palette.selection : palette.fill }]}
            >
              <Icon name="close" size={16} />
            </Pressable>
          ) : undefined
        }
      >
        {children}
      </ListRow>
    </View>
  );

  const words = (text: string, code: string = shown, tint?: string) => (
    <Scripture step="claim" numberOfLines={ax ? 5 : 3} style={{ fontFamily: FONTS.scripture }}>
      {tint === undefined ? (
        <DivineText text={text} translation={code} />
      ) : (
        // A nested Text, so the tint follows the words line by line, as in the reader (Verse.tsx's wash).
        <Text style={{ backgroundColor: tint, color: palette.ink }}>
          <DivineText text={text} translation={code} />
        </Text>
      )}
    </Scripture>
  );

  /** SA-30's chapter head: the chapter in Literata, how many are kept in it beside. */
  const chapterHead = (title: string, count: number, noun: string, first: boolean) => (
    <View key={`head-${title}`} style={[styles.chapterHead, { marginTop: first ? 20 : sectionGap }]}>
      <SectionTitle style={{ fontFamily: FONTS.scripture, fontWeight: "600" }}>{title}</SectionTitle>
      <Chrome step="note" tone="muted">{`${count} ${noun}${count === 1 ? "" : "s"}`}</Chrome>
    </View>
  );

  const rows = (): ReactNode => {
    if (lists === null) return null;
    if (tab === "highlights")
      return byChapter(lists.highlights, (h) => h.verse_id).flatMap((group, g) => [
        chapterHead(group.title, group.items.length, "highlight", g === 0),
        ...group.items.map(({ item: { verse_id, color }, ref }, i) => {
          const text = excerptFor(ref);
          return removable(
            verse_id,
            `${labelFor(ref)}, ${highlightSpoken(color)}. ${text}`,
            () => openVerse(ref),
            () => void setHighlight(user, [verse_id], null).then(reload),
            i === 0,
            words(text, shown, palette.highlights[color]),
            labelFor(ref),
          );
        }),
      ]);
    if (tab === "notes")
      return lists.notes.map(({ target, body }, i) => {
        const verse = parseVerseId(target);
        const chapter = verse === null ? parseChapterKey(target) : null;
        const place = verse !== null ? verseLabel(verse) : chapter !== null ? chapterTitle(chapter.book, chapter.chapter) : null;
        if (place === null) return null;
        const open = () =>
          router.push({
            pathname: "/note",
            params:
              verse !== null
                ? { book: verse.book, chapter: String(verse.chapter), verse: String(verse.verse) }
                : { book: chapter?.book ?? "", chapter: String(chapter?.chapter ?? 1), whole: "1" },
          });
        return removable(
          target,
          `Your note on ${place}. ${body}`,
          open,
          () => void saveNote(user, target, "").then(reload),
          i === 0,
          // The reader's own words, in Literata as everything written about Scripture is (design system).
          <Scripture step="claim" numberOfLines={ax ? 3 : 2} style={{ fontFamily: "Literata" }}>
            {body}
          </Scripture>,
          place,
        );
      });
    if (tab === "bookmarks")
      return byChapter(lists.bookmarks, (id) => id).flatMap((group, g) => [
        chapterHead(group.title, group.items.length, "bookmark", g === 0),
        ...group.items.map(({ item: id, ref }, i) => {
          const text = excerptFor(ref);
          return removable(id, `${labelFor(ref)}. ${text}`, () => openVerse(ref), () => void removeBookmark(user, id).then(reload), i === 0, words(text), labelFor(ref));
        }),
      ]);
    return lists.images.map((image, i) => {
      const ref = parseVerseId(image.verse_id);
      if (ref === null) return null;
      const range = Array.from({ length: image.through - ref.verse + 1 }, (_, n) => verseOrd(ref.book, ref.chapter, ref.verse + n));
      const code = imageCode(image);
      const read = imageTexts?.get(code);
      const text = range.map((ord, n) => `${range.length === 1 ? "" : `${ref.verse + n} `}${excerptOf(read?.get(ord) ?? "")}`).join(" ");
      const place = `${chapterTitle(ref.book, ref.chapter)}:${ref.verse}${image.through > ref.verse ? `–${image.through}` : ""}`;
      const open = () =>
        router.push({
          pathname: "/share-image",
          params: { verse: image.verse_id, through: String(image.through), translation: image.translation, ground: image.ground, day: String(image.picture_day) },
        });
      return removable(
        `image-${image.id}`,
        `Image of ${place}`,
        open,
        () => void removeVerseImage(user, image.id).then(reload),
        i === 0,
        <View style={styles.withImage}>
          <View accessible={false} importantForAccessibility="no-hide-descendants">
            <VerseImage text={text} label={`${place} · ${image.translation}`} ground={image.ground} pictureDay={image.picture_day} size={64} />
          </View>
          <View style={{ flex: 1 }}>{words(text, code)}</View>
        </View>,
        `${place} · ${image.translation}`,
      );
    });
  };

  const list = lists?.[tab] ?? [];
  const exportAll = () => {
    if (lists === null) return;
    const lines = [
      ...lists.highlights.flatMap(({ verse_id, color }) => {
        const ref = parseVerseId(verse_id);
        return ref === null ? [] : [`${verseLabel(ref)} (${color}) — ${excerptFor(ref)}`];
      }),
      ...lists.notes.flatMap(({ target, body }) => {
        const verse = parseVerseId(target);
        const chapter = verse === null ? parseChapterKey(target) : null;
        const place = verse !== null ? verseLabel(verse) : chapter !== null ? chapterTitle(chapter.book, chapter.chapter) : null;
        return place === null ? [] : [`${place}: ${body}`];
      }),
    ];
    void Share.share({ message: lines.join("\n\n") });
  };

  return (
    <PageScreen
      title="Saved"
      back={params.back ?? "You"}
      testID="saved"
      right={
        <MenuView
          shouldOpenOnLongPress={false}
          actions={[
            // imageColor always set: without it @react-native-menu draws the glyph transparent (index.tsx, 10 Oct 2026).
            { id: "edit", title: editing ? "Done" : "Edit", image: editing ? "checkmark" : "pencil", imageColor: palette.ink, attributes: { disabled: list.length === 0 } },
            { id: "export", title: "Export", image: "square.and.arrow.up", imageColor: palette.ink, attributes: { disabled: lists === null || lists.highlights.length + lists.notes.length === 0 } },
          ]}
          onPressAction={({ nativeEvent }) => (nativeEvent.event === "edit" ? setEditing((e) => !e) : exportAll())}
          testID="saved-more"
        >
          <View pointerEvents="none" accessible accessibilityRole="button" accessibilityLabel="More: Edit, Export">
            <GlassButton>
              <Icon name="more" size={20} />
            </GlassButton>
          </View>
        </MenuView>
      }
    >
      <FilterPills
        options={TABS}
        chosen={tab}
        onChoose={(next) => {
          setTab(next);
          setEditing(false);
        }}
        testID="saved-tab"
      />
      {tab === "notes" || tab === "images" || list.length === 0 ? <View style={{ height: 20 }} /> : null}
      {lists !== null && list.length === 0 ? (
        <View testID={`saved-empty-${tab}`}>
          <Chrome tone="ink" style={styles.empty} maxFontSizeMultiplier={2.2}>
            {EMPTY[tab][0]}
          </Chrome>
          <Chrome step="note" tone="muted">
            {EMPTY[tab][1]}
          </Chrome>
        </View>
      ) : (
        rows()
      )}
      {lists !== null && list.length > 0 && cloudAvailable() && tab !== "images" ? (
        <Chrome step="note" tone="muted" style={styles.kept} testID="saved-icloud">
          {signedOut ? "On this iPhone only. Sign in to iCloud in Settings to keep them." : "Kept in iCloud when you’re signed in. Only you see them."}
        </Chrome>
      ) : null}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: "Literata", fontSize: 22, lineHeight: 29, marginBottom: 6 },
  kept: { marginTop: 20 },
  remove: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  withImage: { flexDirection: "row", columnGap: 12, alignItems: "stretch" },
  chapterHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", columnGap: 12, marginBottom: 2 },
});

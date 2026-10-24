/**
 * Sources (canvas SO-01, SO-02, ST-04), formerly Library: where every word of text, data and explanation
 * comes from.
 *
 * The built-in texts ship inside the app (John's decision 4); downloaded
 * translations are saved on the phone, so one line says both work offline
 * (S13, S14; wording from the more-translations plan). Rows are Apple
 * Settings' plain disclosure rows, the whole row the target
 * (https://mobbin.com/screens/9343e7b1-2483-4855-9655-0785d42c88a6; S19).
 *
 * Licences come from the core bundle's `sources` table, and each download's
 * from the `meta` table inside its own file (rule 3). The LSV's CC BY-SA
 * notice is shown in full under its row. The `encumbered` notes are the
 * team's open legal questions, not terms for readers, and stay out of the UI
 * (S15); PRD 0E still has to close them.
 */

import { useEffect } from "react";
import { licensedCodes, licensedEnabled } from "../data/useLicensedChapter";
import { Linking, View } from "react-native";

import { ListRow, PageScreen } from "../components/Page";
import { Chrome, Prose, SectionTitle } from "../components/Type";
import { useCore, useQuery } from "../data/AppData";
import { getSources, getTranslationSources } from "../data/queries";
import { refreshRecordings, useRecordings } from "../data/recordings";
import { loadStudySources, useStudy } from "../data/study";
import { useTranslations } from "../data/translations";
import { loadAnyUnderstandSources, useUnderstand } from "../data/understand";
import { useLayout } from "../design/tokens";
import { todaySources } from "../data/today";
import { type SourceGroup, sourceItems, studySourceItem } from "../lib/sources";
import { BIBLEPROJECT_CREDIT } from "../lib/overviews";

const GROUPS: readonly SourceGroup[] = ["Bible text", "Words and people", "Understand", "Today"];

/** A row that opens its source's page, when it has one. */
const opens = (url: string | undefined) => (url === undefined ? {} : { onPress: () => void Linking.openURL(url) });

export default function SourcesScreen() {
  return (
    // ST-04: reached from Settings (IA-11), named for both halves of what it lists.
    <PageScreen title="Sources and licences" back="Settings" subtitle="Built-in texts need no connection. Downloaded translations work offline once saved." testID="sources">
      <SourcesList />
    </PageScreen>
  );
}

/**
 * Every source and licence. A page from Settings; inside Understand and the guide it is pushed in the sheet's own
 * stack (understand/sources, guide/sources), so it never stacks a page over a sheet (IA stress test, 15 Oct 2026).
 */
export function SourcesList() {
  const core = useCore();
  const { ax, sectionGap } = useLayout();
  const installed = useTranslations((s) => s.installed);
  const { data: sources } = useQuery(
    async () => [...(await getSources(core)), ...(await getTranslationSources(core)), ...(await todaySources())],
    [installed.map((t) => t.code).join(",")],
  );
  const understandBooks = useUnderstand((s) => Object.keys(s.installed).join(","));
  const { data: explanations } = useQuery(() => loadAnyUnderstandSources(), [understandBooks]);
  const items = sourceItems(sources ?? []);
  const studyBooks = useStudy((s) => Object.keys(s.installed).join(","));
  const { data: study } = useQuery(() => loadStudySources(), [studyBooks]);
  const all = useRecordings((s) => s.all);
  const readings = all.filter((a, i) => all.findIndex((b) => b.narrator === a.narrator) === i);
  useEffect(() => void refreshRecordings(), []);

  const groupView = (group: SourceGroup) => {
        const rows = items.filter((item) => item.group === group);
        if (rows.length === 0) return null;
        return (
          <View key={group} style={{ marginTop: sectionGap }}>
            <SectionTitle style={{ marginBottom: 6 }}>{group}</SectionTitle>
            {rows.map((item, i) => (
              <ListRow
                key={item.dataset}
                first={i === 0}
                title={item.title}
                // ST-04: the licence trails the name; at AX sizes it stacks under it, as the frame's AX5 does.
                right={ax || item.attribution !== null ? undefined : <Chrome tone="muted" numberOfLines={2} style={{ textAlign: "right", maxWidth: 170 }}>{item.value}</Chrome>}
                subtitle={
                  !ax && item.attribution === null ? undefined : item.attribution === null ? (
                    item.value
                  ) : (
                    <>
                      <Chrome step="note" tone="muted">
                        {item.subtitle}
                      </Chrome>
                      {/* CC BY-SA: the notice in full, as the source states it. */}
                      <Chrome step="note" tone="muted" testID={`attribution-${item.title}`}>
                        {item.attribution}
                      </Chrome>
                    </>
                  )
                }
                label={item.label}
                onPress={() => void Linking.openURL(item.url)}
                testID={`source-${item.title}`}
              />
            ))}
          </View>
        );  };

  return (
    <>
      {/* ST-04: the Bible's own text first. */}
      {groupView("Bible text")}
      {/* Explanations (ST-04): every source Understand is built from, with what was changed, read from
          the book's own file (rule 3). Credited here once, never under each line (Phase 1). */}
      {explanations !== undefined && explanations.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>Explanations</SectionTitle>
          {explanations
            .filter((source) => source.key !== "twl")
            .map((source, i) => (
              <ListRow
                key={source.key}
                first={i === 0}
                title={source.name.replace(/^unfoldingWord /u, "")}
                label={`${source.name}. ${source.credit}`}
                testID={`source-understand-${source.key}`}
                subtitle={
                  <>
                    <Chrome step="note" tone="muted">
                      {source.credit}
                    </Chrome>
                    {source.original !== null ? (
                      <Chrome step="note" tone="muted" style={{ marginTop: 4 }}>
                        {source.original}
                      </Chrome>
                    ) : null}
                  </>
                }
              />
            ))}
          <Chrome step="note" tone="muted" style={{ marginTop: 8 }}>
            Yada’s adapted data is shared under CC BY‑SA 4.0, as these licences ask.
          </Chrome>
        </View>
      ) : null}

      {/* SC-08 (rule 3): the full credit for the book introductions, before the short line under each paragraph ships.
          tN's licence is read from the book's own file and listed under Explanations; this says what was adapted. */}
      {explanations !== undefined && explanations.some((source) => source.key === "tn") ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>Book introductions</SectionTitle>
          <Prose step="claim" testID="source-book-intros">
            The opening paragraph of each book’s introduction is from unfoldingWord® Translation Notes, front introductions. Adapted: the first paragraph only, sometimes shortened. Licensed CC BY-SA 4.0; this adaptation is shared under the same licence.
          </Prose>
          <View style={{ marginTop: 8 }}>
            <ListRow first title="unfoldingWord Translation Notes" subtitle="unfoldingword.org · CC BY-SA 4.0" {...opens("https://www.unfoldingword.org")} testID="source-intros-tn" />
            <ListRow title="The licence" subtitle="creativecommons.org/licenses/by-sa/4.0" {...opens("https://creativecommons.org/licenses/by-sa/4.0/")} testID="source-intros-licence" />
          </View>
        </View>
      ) : null}

      {/* Daily prayer's collects (lib/collects.ts): the book names no copyright, and the Episcopal Church's canons hold its
          authorized Prayer Book in the public domain (resolution 2024-D038, explanation). */}
      <View style={{ marginTop: sectionGap }}>
        <SectionTitle style={{ marginBottom: 6 }}>The collects</SectionTitle>
        <Prose step="claim" testID="source-collects">
          Daily prayer’s collects are from The Book of Common Prayer (1979) of the Episcopal Church, in their traditional wording, word for word. The authorized Prayer Book is in the public domain.
        </Prose>
        <View style={{ marginTop: 8 }}>
          <ListRow first title="The Book of Common Prayer" subtitle="episcopalchurch.org · public domain" {...opens("https://www.episcopalchurch.org/who-we-are/how-we-worship/book-of-common-prayer/")} testID="source-bcp" />
        </View>
      </View>

      {/* OR-03: the overview videos link to BibleProject, who asked for this credit (19 Oct 2026). */}
      <View style={{ marginTop: sectionGap }}>
        <SectionTitle style={{ marginBottom: 6 }}>Book overview videos</SectionTitle>
        <Prose step="claim">{BIBLEPROJECT_CREDIT}</Prose>
        <View style={{ marginTop: 8 }}>
          <ListRow first title="BibleProject" subtitle="bibleproject.com" {...opens("https://bibleproject.com")} testID="source-bibleproject" />
        </View>
      </View>

      {GROUPS.filter((g) => g !== "Bible text").map(groupView)}

      {/* ST-04 Read online: the licensed versions, shown only, never kept for AI or audio (rule 9).
          The row links to api.bible: the Starter plan requires a visible citation and hyperlink in the app
          (API.Bible terms, Minimum Acceptable Use, read 18 Oct 2026). */}
      {licensedEnabled() ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>Read online</SectionTitle>
          <ListRow
            first
            title={licensedCodes().map((c) => (c === "MSG" ? "The Message" : c)).join(" · ")}
            subtitle="API.Bible · display only"
            {...opens("https://api.bible")}
            testID="source-read-online"
          />
        </View>
      ) : null}

      {/* Audio (Phase 4): each reading once, with the licence the manifest carries from its source (rule 3).
          A computer voice says so here too (John, 12 Oct 2026). */}
      {readings.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>Audio</SectionTitle>
          {readings.map((reading, i) => (
            <ListRow
              key={reading.narrator}
              first={i === 0}
              title={`${reading.narrator_name}, computer voice`}
              subtitle={reading.credit ?? ""}
              {...opens(reading.credit_url)}
              testID={`source-audio-${reading.narrator}`}
            />
          ))}
        </View>
      ) : null}

      {/* Study notes (artifact, "Rules this follows"): both sources with their attribution and the
          licence statement in full, read from a downloaded study file's own sources table (rule 3),
          and for Tyndale's share-alike notes, what was changed. */}
      {study !== undefined && study.length > 0 ? (
        <View style={{ marginTop: sectionGap }}>
          <SectionTitle style={{ marginBottom: 6 }}>Study notes</SectionTitle>
          {study.map((source, i) => {
            const item = studySourceItem(source);
            return (
              <ListRow
                key={source.key}
                first={i === 0}
                title={item.title}
                label={item.label}
                onPress={() => void Linking.openURL(source.homepage)}
                testID={`source-study-${source.key}`}
                subtitle={
                  <>
                    <Chrome step="note" tone="muted">
                      {item.subtitle}
                    </Chrome>
                    {item.lines.map((line) => (
                      <Chrome key={line} step="note" tone="muted" style={{ marginTop: 4 }}>
                        {line}
                      </Chrome>
                    ))}
                  </>
                }
              />
            );
          })}
        </View>
      ) : null}
    </>
  );
}

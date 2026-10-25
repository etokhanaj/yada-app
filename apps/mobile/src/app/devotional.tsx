/**
 * The devotional (DR-13; Build 12 DV-30, John 24 Oct 2026: "where our devotional?"). Spurgeon's entry for the date,
 * whole and unchanged: "Devotional · morning", his heading large in Literata, the verse it is on, the reading, the
 * other half of the day, the credit. Docked: Share, and Sit with its verse (SW-01 with that verse). No Listen: it is
 * not recorded, and no iPhone voice reads (Build 12). Reaching the end ticks it on Today.
 *
 * Public domain (Morning and Evening; read from the pinned CCEL copy, docs/build-7-plan.md §3). Never written or
 * edited by Yada (rule 2); an entry John rejects in review is never shown.
 */

import { formatVerseId, parseReference } from "@yada/schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Capsule } from "../components/ActionBar";
import { Icon } from "../components/Icon";
import { ListRow, PageScreen } from "../components/Page";
import { SourceLine } from "../components/SourceLine";
import { Chrome, Prose } from "../components/Type";
import { useAppData, useCore } from "../data/AppData";
import { openDevotional } from "../data/bundles";
import { textOf } from "../data/today";
import { markDone } from "../data/user";
import { FONTS, useLayout } from "../design/tokens";
import { sittable } from "../lib/sit";
import { useSettings } from "../state/settings";

interface Entry {
  readonly heading: string;
  readonly ref: string;
  readonly body: string;
}

export default function Devotional() {
  const { key, part } = useLocalSearchParams<{ key: string; part: string }>();
  const core = useCore();
  const { user } = useAppData();
  const translation = useSettings((s) => s.translation);
  const { ax, pill } = useLayout();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [verse, setVerse] = useState<{ text: string; bsb: boolean; place: string } | null>(null);
  // DR-13 ends on the other half of the day ("For the evening · Matthew 24:39"); John kept both, 16 Oct 2026.
  const other = part === "evening" ? "morning" : "evening";
  const [otherRef, setOtherRef] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void openDevotional().then(async (db) => {
      if (db === null) return;
      const query = "SELECT heading, ref, body FROM entries WHERE mmdd = ? AND part IN (?, ?) AND status != 'rejected'";
      const row = await db.getFirstAsync<Entry>(query, [key ?? "", part ?? "morning", part === "evening" ? "pm" : "am"]);
      const next = await db.getFirstAsync<Entry>(query, [key ?? "", other, other === "evening" ? "pm" : "am"]);
      if (!live) return;
      setEntry(row);
      setOtherRef(next?.ref ?? null);
      // His verse, in the reader's translation (the BSB under a licensed one, rule 9), for Sit with it.
      const r = row === null ? null : parseReference(row.ref);
      if (r === null || r.verse === undefined) return;
      const at = { book: r.book, chapter: r.chapter, verse: r.verse };
      const v = await textOf(core, at, translation);
      if (live && v.text !== "" && sittable(v.text)) setVerse({ text: v.text, bsb: v.bsb, place: formatVerseId(at) });
    });
    return () => {
      live = false;
    };
  }, [key, part, other, core, translation]);

  const sit = () =>
    verse !== null &&
    entry !== null &&
    router.push({ pathname: "/sit", params: { text: verse.text, ref: entry.ref, bsb: verse.bsb ? "1" : "", place: verse.place, why: "Devotional" } });

  const heading =
    entry === null ? null : (
      <View style={{ rowGap: 6 }}>
        <Chrome step="note" tone="muted" style={{ fontWeight: "600" }}>
          {part === "evening" ? "Devotional · evening" : "Devotional · morning"}
        </Chrome>
        <Chrome tone="ink" accessibilityRole="header" style={{ fontFamily: FONTS.scripture, fontWeight: "400" }} size={30} maxFontSizeMultiplier={1.6}>
          {entry.heading}
        </Chrome>
        <Chrome step="note" tone="muted">
          {entry.ref}
        </Chrome>
      </View>
    );

  return (
    <PageScreen
      title={entry?.heading ?? "Devotional"}
      titleNode={heading ?? <View />}
      back="Today"
      // Reaching the end of the reading ticks it on Today (TD-30).
      onReachEnd={() => void markDone(user, "devotional").catch(() => undefined)}
      footer={
        verse === null ? undefined : (
          <View style={ax ? { rowGap: 8 } : { flexDirection: "row", columnGap: 8 }}>
            <Capsule square={!ax} grow={ax} height={pill} onPress={() => router.push({ pathname: "/share-image", params: { verse: verse.place } })} label={`Share ${entry?.ref ?? ""}`} testID="devotional-share">
              <Icon name="share" size={20} />
            </Capsule>
            <Capsule grow height={pill} onPress={sit} label={`Sit with ${entry?.ref ?? "this verse"}`} testID="devotional-sit">
              <Icon name="sit" size={20} />
              <Chrome tone="ink" numberOfLines={1} style={{ fontWeight: "600" }}>{`Sit with ${entry?.ref ?? ""}`}</Chrome>
            </Capsule>
          </View>
        )
      }
      testID="devotional"
    >
      {entry === null ? null : (
        <View style={{ rowGap: 16 }}>
          {entry.body
            .split(/\n\s*\n/u)
            .filter((p) => p.trim() !== "")
            .map((p, i) => (
              <Prose key={i}>{p.trim()}</Prose>
            ))}
          {otherRef !== null ? (
            <ListRow
              first
              title={other === "evening" ? "For the evening" : "For the morning"}
              subtitle={otherRef}
              // Replace, not push: the page swaps halves and ‹ Today still goes back to Today.
              onPress={() => router.replace({ pathname: "/devotional", params: { key: key ?? "", part: other } })}
              testID="devotional-other"
            />
          ) : null}
          <SourceLine>Spurgeon, Morning and Evening</SourceLine>
        </View>
      )}
    </PageScreen>
  );
}

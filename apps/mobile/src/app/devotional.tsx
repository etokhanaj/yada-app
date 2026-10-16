/**
 * The devotional (canvas DR-13): Spurgeon's entry for the date, whole and unchanged, his heading first and the
 * credit once at the end. Public domain (Morning and Evening; read from the pinned CCEL copy, docs/build-7-plan.md
 * §3). Never written or edited by Yada (rule 2); an entry John rejects in review is never shown.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { ListRow, PageScreen } from "../components/Page";
import { Chrome, Prose } from "../components/Type";
import { openDevotional } from "../data/bundles";
import { FONTS } from "../design/tokens";

interface Entry {
  readonly heading: string;
  readonly ref: string;
  readonly body: string;
}

export default function Devotional() {
  const { key, part } = useLocalSearchParams<{ key: string; part: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
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
    });
    return () => {
      live = false;
    };
  }, [key, part]);

  const title = part === "evening" ? "Evening devotional" : "Morning devotional";
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // DR-13's date line, from the entry's own key; without DR-13's "· morning", which the title already says.
  const date = key === undefined || key.length !== 4 ? "" : `${Number(key.slice(2))} ${months[Number(key.slice(0, 2)) - 1] ?? ""}`;
  return (
    <PageScreen title={title} back="Today" testID="devotional">
      {entry === null ? null : (
        <View style={{ rowGap: 16 }}>
          <View style={{ rowGap: 4 }}>
            {date !== "" ? (
              <Chrome step="note" tone="muted">
                {date}
              </Chrome>
            ) : null}
            <Chrome tone="ink" style={{ fontFamily: FONTS.scripture, fontSize: 26, lineHeight: 34, fontWeight: "600" }}>
              {entry.heading}
            </Chrome>
            <Chrome step="note" tone="muted">
              {entry.ref}
            </Chrome>
          </View>
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
          <Chrome step="note" tone="muted">
            C. H. Spurgeon, Morning and Evening. Public domain.
          </Chrome>
        </View>
      )}
    </PageScreen>
  );
}

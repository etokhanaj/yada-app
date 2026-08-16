/**
 * On-device SQLite capability probe (rubric item 3).
 *
 * The bundle format depends on two things being true in the app's SQLite
 * driver: FTS5 for offline full-text search, and ATTACH so a base database and
 * per-book Understand bundles can be queried together. If expo-sqlite lacks
 * either, the fallback is op-sqlite. This screen answers that on hardware
 * rather than from documentation.
 */

import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { leading, METADATA_LABEL, SPACE, TYPE, usePalette } from "../design/tokens";

interface ProbeResult {
  name: string;
  passed: boolean;
  detail: string;
}

async function runProbes(): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  // --- SQLite version -----------------------------------------------------
  let base: SQLite.SQLiteDatabase | null = null;
  try {
    base = await SQLite.openDatabaseAsync("probe_base.db");
    const row = await base.getFirstAsync<{ v: string }>("SELECT sqlite_version() AS v");
    results.push({
      name: "Open database",
      passed: true,
      detail: `SQLite ${row?.v ?? "unknown"}`,
    });
  } catch (error) {
    results.push({ name: "Open database", passed: false, detail: String(error) });
    return results;
  }

  // --- FTS5 ---------------------------------------------------------------
  try {
    await base.execAsync(`
      DROP TABLE IF EXISTS verse_fts;
      CREATE VIRTUAL TABLE verse_fts USING fts5(verse_id, text);
      INSERT INTO verse_fts (verse_id, text) VALUES
        ('JHN.1.1', 'In the beginning was the Word'),
        ('GEN.1.1', 'In the beginning God created the heavens and the earth'),
        ('1CO.14.34', 'Let the wives be quiet in the assemblies');
    `);
    const hits = await base.getAllAsync<{ verse_id: string }>(
      "SELECT verse_id FROM verse_fts WHERE verse_fts MATCH ? ORDER BY verse_id",
      ["beginning"],
    );
    const ids = hits.map((h) => h.verse_id).join(", ");
    results.push({
      name: "FTS5 virtual table + MATCH",
      passed: hits.length === 2,
      detail: `${hits.length} hit(s) for "beginning": ${ids}`,
    });
  } catch (error) {
    results.push({ name: "FTS5 virtual table + MATCH", passed: false, detail: String(error) });
  }

  // --- ATTACH -------------------------------------------------------------
  try {
    const bundle = await SQLite.openDatabaseAsync("probe_bundle.db");
    await bundle.execAsync(`
      DROP TABLE IF EXISTS entries;
      CREATE TABLE entries (verse_id TEXT PRIMARY KEY, claims INTEGER);
      INSERT INTO entries VALUES ('JHN.1.1', 12), ('GEN.1.1', 10);
    `);
    await bundle.closeAsync();

    const directory = (SQLite as unknown as { defaultDatabaseDirectory?: string })
      .defaultDatabaseDirectory;
    const attachPath =
      directory === undefined
        ? "probe_bundle.db"
        : `${directory.replace(/\/$/, "")}/probe_bundle.db`;

    await base.execAsync(`ATTACH DATABASE '${attachPath}' AS bundle`);
    const joined = await base.getAllAsync<{ verse_id: string; claims: number }>(`
      SELECT f.verse_id AS verse_id, b.claims AS claims
      FROM verse_fts f JOIN bundle.entries b ON b.verse_id = f.verse_id
      ORDER BY f.verse_id
    `);
    await base.execAsync("DETACH DATABASE bundle");

    results.push({
      name: "ATTACH + cross-database join",
      passed: joined.length === 2,
      detail:
        joined.length === 0
          ? `joined 0 rows (attach path: ${attachPath})`
          : joined.map((r) => `${r.verse_id}=${r.claims}`).join(", "),
    });
  } catch (error) {
    results.push({ name: "ATTACH + cross-database join", passed: false, detail: String(error) });
  }

  await base.closeAsync();
  return results;
}

export default function ProbeScreen() {
  const palette = usePalette();
  const [results, setResults] = useState<ProbeResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    runProbes()
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResults([{ name: "Probe crashed", passed: false, detail: String(error) }]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView
      style={{ backgroundColor: palette.paper }}
      contentContainerStyle={{ padding: SPACE.lg, paddingTop: SPACE.xl * 2 }}
    >
      <Text style={[METADATA_LABEL, { color: palette.mutedInk }]}>SQLite capability probe</Text>
      {results === null ? (
        <Text style={{ color: palette.mutedInk, marginTop: SPACE.md }}>Running…</Text>
      ) : (
        results.map((result) => (
          <View
            key={result.name}
            style={[styles.row, { borderTopColor: palette.divider }]}
          >
            <Text
              style={{
                fontSize: TYPE.claim.size,
                lineHeight: leading(TYPE.claim.size, TYPE.claim.ratio),
                color: palette.ink,
              }}
            >
              {result.passed ? "PASS" : "FAIL"} · {result.name}
            </Text>
            <Text
              style={{
                fontSize: TYPE.meta.size,
                lineHeight: leading(TYPE.meta.size, TYPE.meta.ratio),
                color: palette.mutedInk,
                marginTop: SPACE.xs,
              }}
            >
              {result.detail}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACE.md,
    marginTop: SPACE.md,
  },
});

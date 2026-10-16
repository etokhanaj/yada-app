/**
 * The shipped bundles: copy them out of the app once, open them, never close.
 *
 * Three rules from the 0A spike and the bundle format:
 *
 *   1. Never close a connection. expo-sqlite SIGSEGVs closing a database that
 *      holds an FTS5 table (docs/0a-findings.md, finding 2); the core bundle
 *      holds one. Connections live for the life of the process.
 *   2. Each book's Understand and study bundle is its own connection, opened
 *      lazily the first time that book is asked for (data/bookFiles.ts), not
 *      ATTACHed to core: SQLite's default limit is 10 attached databases.
 *   3. Files are copied under their versioned names (core.v2.db) and a copy is
 *      refreshed when the manifest's digest changes. A file the manifest no
 *      longer lists is deleted at launch, before anything could have opened it.
 *
 * All bundles ship inside the app for v1 (John's decision 4): there is no
 * download manager and nothing here talks to a network.
 */

import { type BundleInfo } from "@yada/schema";
import { deleteDatabaseAsync, importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { BUNDLED_ASSETS, BUNDLED_DAILY, BUNDLED_MANIFEST, BUNDLED_STUDY, BUNDLED_UNDERSTAND } from "./bundled.generated";
import { USER_DB, USER_DDL } from "./user";

export const CORE_BUNDLE: BundleInfo | undefined = BUNDLED_MANIFEST.bundles.find((b) => b.kind === "core");

let userPromise: Promise<SQLiteDatabase> | null = null;

export function openUser(): Promise<SQLiteDatabase> {
  userPromise ??= (async () => {
    const db = await openDatabaseAsync(USER_DB);
    await db.execAsync(USER_DDL);
    return db;
  })();
  // A failed open is not kept: US-10's Try again must really try again (review, 13 Oct 2026).
  userPromise.catch(() => {
    userPromise = null;
  });
  return userPromise;
}

/** Copy new or changed bundles into the SQLite directory, and remove ones no longer shipped. */
export async function installBundles(user: SQLiteDatabase): Promise<void> {
  const installed = new Map(
    (await user.getAllAsync<{ file: string; sha256: string }>("SELECT file, sha256 FROM installed_bundles")).map((r) => [
      r.file,
      r.sha256,
    ]),
  );
  // John's study and Understand bundles ship too (build 3, 11 Oct; Phase 0, 12 Oct): copied and
  // refreshed like the rest.
  const shipped = [...BUNDLED_MANIFEST.bundles, ...BUNDLED_STUDY, ...BUNDLED_UNDERSTAND, ...BUNDLED_DAILY];
  const wanted = new Set(shipped.map((b) => b.file));

  for (const [file] of installed) {
    if (wanted.has(file)) continue;
    // Nothing has opened a bundle yet this launch, so deleting cannot pull a
    // file out from under a live connection.
    await deleteDatabaseAsync(file).catch(() => undefined);
    await user.runAsync("DELETE FROM installed_bundles WHERE file = ?", [file]);
  }

  for (const bundle of shipped) {
    if (installed.get(bundle.file) === bundle.sha256) continue;
    const assetId = BUNDLED_ASSETS[bundle.file];
    if (assetId === undefined) throw new Error(`${bundle.file} is in the manifest but not bundled as an asset`);
    await importDatabaseFromAssetAsync(bundle.file, { assetId, forceOverwrite: true });
    await user.runAsync(
      "INSERT INTO installed_bundles (file, sha256) VALUES (?, ?) ON CONFLICT(file) DO UPDATE SET sha256 = excluded.sha256",
      [bundle.file, bundle.sha256],
    );
  }
}

let corePromise: Promise<SQLiteDatabase> | null = null;

export function openCore(): Promise<SQLiteDatabase> {
  if (CORE_BUNDLE === undefined) throw new Error("No core bundle in the manifest");
  if (corePromise === null) {
    corePromise = openDatabaseAsync(CORE_BUNDLE.file);
    corePromise.catch(() => {
      corePromise = null;
    });
  }
  return corePromise;
}

let devotionalPromise: Promise<SQLiteDatabase | null> | null = null;

/** Spurgeon's Morning and Evening (build 7), or null when this build shipped without it. */
export function openDevotional(): Promise<SQLiteDatabase | null> {
  const file = BUNDLED_DAILY[0]?.file;
  if (file === undefined) return Promise.resolve(null);
  if (devotionalPromise === null) {
    devotionalPromise = openDatabaseAsync(file);
    devotionalPromise.catch(() => {
      devotionalPromise = null;
    });
  }
  return devotionalPromise;
}

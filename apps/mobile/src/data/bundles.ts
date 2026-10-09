/**
 * The shipped bundles: copy them out of the app once, open them, never close.
 *
 * Three rules from the 0A spike and the bundle format:
 *
 *   1. Never close a connection. expo-sqlite SIGSEGVs closing a database that
 *      holds an FTS5 table (docs/0a-findings.md, finding 2); the core bundle
 *      holds one. Connections live for the life of the process.
 *   2. Each book's Understand bundle is its own connection, opened lazily the
 *      first time that book is asked for — not ATTACHed to core. SQLite's
 *      default limit is 10 attached databases and there will be 66 books.
 *   3. Files are copied under their versioned names (core.v2.db) and a copy is
 *      refreshed when the manifest's digest changes. A file the manifest no
 *      longer lists is deleted at launch, before anything could have opened it.
 *
 * All bundles ship inside the app for v1 (John's decision 4): there is no
 * download manager and nothing here talks to a network.
 */

import { type BookCode, type BundleInfo } from "@yada/schema";
import { deleteDatabaseAsync, importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { BUNDLED_ASSETS, BUNDLED_MANIFEST } from "./bundled.generated";
import { USER_DB, USER_DDL } from "./user";

export const CORE_BUNDLE: BundleInfo | undefined = BUNDLED_MANIFEST.bundles.find((b) => b.kind === "core");

export function understandBundle(book: BookCode): BundleInfo | undefined {
  return BUNDLED_MANIFEST.bundles.find((b) => b.kind === "understand" && b.book === book);
}

export const UNDERSTAND_BUNDLES: readonly BundleInfo[] = BUNDLED_MANIFEST.bundles.filter((b) => b.kind === "understand");

let userPromise: Promise<SQLiteDatabase> | null = null;

export function openUser(): Promise<SQLiteDatabase> {
  userPromise ??= (async () => {
    const db = await openDatabaseAsync(USER_DB);
    await db.execAsync(USER_DDL);
    return db;
  })();
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
  const wanted = new Set(BUNDLED_MANIFEST.bundles.map((b) => b.file));

  for (const [file] of installed) {
    if (wanted.has(file)) continue;
    // Nothing has opened a bundle yet this launch, so deleting cannot pull a
    // file out from under a live connection.
    await deleteDatabaseAsync(file).catch(() => undefined);
    await user.runAsync("DELETE FROM installed_bundles WHERE file = ?", [file]);
  }

  for (const bundle of BUNDLED_MANIFEST.bundles) {
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
  corePromise ??= openDatabaseAsync(CORE_BUNDLE.file);
  return corePromise;
}

const bookConnections = new Map<BookCode, Promise<SQLiteDatabase | null>>();

/** The book's Understand bundle, or null when that book has none yet. */
export function openBook(book: BookCode): Promise<SQLiteDatabase | null> {
  let connection = bookConnections.get(book);
  if (connection === undefined) {
    const bundle = understandBundle(book);
    connection = bundle === undefined ? Promise.resolve(null) : openDatabaseAsync(bundle.file);
    bookConnections.set(book, connection);
  }
  return connection;
}

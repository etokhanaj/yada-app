/**
 * `yada publish` — bundles to Cloudflare R2, manifest last.
 *
 * Build plan §4: bundle filenames are immutable (`jhn.v3.db` never changes
 * content), so an app that reads the manifest either sees the old set or the
 * new set, never a mixture — provided every bundle the new manifest names is
 * already in the bucket when the manifest lands. Uploading the manifest last is
 * therefore the whole of the atomic swap, and nothing else in this file is
 * allowed to reorder it.
 *
 * Refusals happen before the first byte is sent, and refuse the entire
 * publish rather than the offending bundle, because a partial publish produces
 * a manifest that describes a set nobody reviewed as a set:
 *
 *   - any `review_gate: "unreviewed-dev"` bundle. Those carry entries no human
 *     approved and exist only for local app builds (bundle.ts).
 *   - any file whose sha256 or size disagrees with the manifest. The app
 *     verifies hashes on download, so a mismatch published is a bundle every
 *     device rejects.
 *   - an existing object under the same immutable name with different content.
 *   - a translation whose gzipped size disagrees with the manifest's `download_bytes`, the size
 *     every Download row shows.
 *
 * Translation files upload gzip-compressed with Content-Encoding gzip (about 7.2 MB to 3.3 MB).
 * NSURLSession, which expo-file-system downloads through, decodes it before writing the file, so
 * `sha256` and `bytes` describe the decompressed file and the app verifies that. Core and book
 * bundles upload as they are.
 *
 * Credentials come from the environment only and are never logged, echoed in
 * an error, or written anywhere — the same rule budget.ts applies to the API key.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { BundleManifestSchema, type BundleInfo, type BundleManifest, type TranslationInfo } from "@yada/schema";

import { BUNDLES } from "./package.js";
import { gzipTranslation } from "./translations.js";

export const R2_ENV = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
export const MANIFEST_KEY = "manifest.json";

export class PublishRefused extends Error {}

export type ObjectStore = Pick<S3Client, "send">;

export interface PlannedBundle {
  info: BundleInfo | TranslationInfo;
  file: string;
  /** Translations only: uploaded as gzipped bytes with Content-Encoding gzip. */
  gzip: boolean;
}

export interface PublishPlan {
  manifest: BundleManifest;
  manifestFile: string;
  bundles: PlannedBundle[];
  /** .db files on disk the manifest does not name: older versions, build temp files. */
  ignored: string[];
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isTranslation(info: BundleInfo | TranslationInfo): info is TranslationInfo {
  return "code" in info;
}

/** The size the manifest promises for the download, when it promises one. */
function downloadSizeProblem(info: BundleInfo | TranslationInfo, gzipped: Uint8Array): string | null {
  if (!isTranslation(info) || info.download_bytes === undefined || gzipped.length === info.download_bytes) return null;
  return `${info.file} gzips to ${gzipped.length} bytes, manifest says ${info.download_bytes}`;
}

/** Everything that can be checked without a network, checked in full. */
export function planPublish(dir: string = BUNDLES): PublishPlan {
  const manifestFile = path.join(dir, MANIFEST_KEY);
  if (!existsSync(manifestFile)) {
    throw new PublishRefused(`no ${MANIFEST_KEY} in ${dir}; run \`yada package\` first`);
  }
  const parsed = BundleManifestSchema.safeParse(JSON.parse(readFileSync(manifestFile, "utf8")));
  if (!parsed.success) {
    throw new PublishRefused(`${MANIFEST_KEY} does not match the bundle manifest schema: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  }
  const manifest = parsed.data;
  if (manifest.bundles.length === 0) {
    // An empty manifest published is every installed app told there is nothing to read.
    throw new PublishRefused(`${MANIFEST_KEY} lists no bundles`);
  }

  const unreviewed = manifest.bundles.filter((b) => b.review_gate === "unreviewed-dev");
  if (unreviewed.length > 0) {
    throw new PublishRefused(
      `refusing the entire publish: ${unreviewed.map((b) => b.file).join(", ")} ` +
        `${unreviewed.length === 1 ? "is" : "are"} unreviewed-dev. Those bundles contain entries no human approved ` +
        `and exist only for local app builds. Rebuild with \`yada package\` (without --allow-unreviewed).`,
    );
  }

  const problems: string[] = [];
  const bundles: PlannedBundle[] = [];
  // Translations upload with the bundles, before the manifest: a manifest offering a download
  // that is not yet in the bucket is a broken row on every phone.
  for (const info of [...manifest.bundles, ...(manifest.translations ?? [])]) {
    const file = path.join(dir, info.file);
    if (!existsSync(file)) {
      problems.push(`${info.file} is listed in the manifest but not on disk`);
      continue;
    }
    const bytes = readFileSync(file);
    const actual = sha256(bytes);
    if (actual !== info.sha256) problems.push(`${info.file} sha256 ${actual} does not match the manifest's ${info.sha256}`);
    if (bytes.length !== info.bytes) problems.push(`${info.file} is ${bytes.length} bytes, manifest says ${info.bytes}`);
    const gzip = isTranslation(info);
    const sizeProblem = gzip ? downloadSizeProblem(info, gzipTranslation(bytes)) : null;
    if (sizeProblem !== null) problems.push(sizeProblem);
    bundles.push({ info, file, gzip });
  }
  if (problems.length > 0) throw new PublishRefused(`refusing the entire publish:\n  ${problems.join("\n  ")}`);

  const listed = new Set(bundles.map((b) => b.info.file));
  const ignored = readdirSync(dir).filter((f) => f.endsWith(".db") && !listed.has(f)).sort();
  return { manifest, manifestFile, bundles, ignored };
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/** Names the missing variables, never the values of the present ones. */
export function r2Config(env: NodeJS.ProcessEnv = process.env): R2Config {
  const missing = R2_ENV.filter((name) => (env[name] ?? "").trim() === "");
  if (missing.length > 0) {
    throw new PublishRefused(
      `missing ${missing.join(", ")}. Export them in the shell for this run only; do not add them to a file in the repo.`,
    );
  }
  return {
    accountId: env["R2_ACCOUNT_ID"] as string,
    accessKeyId: env["R2_ACCESS_KEY_ID"] as string,
    secretAccessKey: env["R2_SECRET_ACCESS_KEY"] as string,
    bucket: env["R2_BUCKET"] as string,
  };
}

export interface PublishOptions {
  /** Nothing is uploaded unless this is true. */
  confirm: boolean;
  dir?: string;
  /** Injected in tests so the ordering and refusals are exercised without R2. */
  client?: ObjectStore;
  env?: NodeJS.ProcessEnv;
}

export interface PublishReport {
  plan: PublishPlan;
  uploaded: string[];
  /** Already in the bucket under the same immutable name with the same hash. */
  unchanged: string[];
  dryRun: boolean;
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}

export async function publish(options: PublishOptions): Promise<PublishReport> {
  const plan = planPublish(options.dir);
  if (!options.confirm) return { plan, uploaded: [], unchanged: [], dryRun: true };

  const config = r2Config(options.env);
  const client =
    options.client ??
    new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });

  // Every existence check before any upload, so an immutability violation
  // refuses the publish with the bucket untouched.
  const toUpload: PlannedBundle[] = [];
  const unchanged: string[] = [];
  for (const bundle of plan.bundles) {
    try {
      const head = (await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: bundle.info.file }))) as {
        Metadata?: Record<string, string>;
        ContentEncoding?: string;
      };
      // A translation uploaded before compression has the right hash but is served whole, so the
      // manifest's `download_bytes` would understate every download of it.
      if (bundle.gzip && head.Metadata?.["sha256"] === bundle.info.sha256 && head.ContentEncoding !== "gzip") {
        throw new PublishRefused(
          `refusing the entire publish: ${bundle.info.file} is in the bucket uncompressed. ` +
            `Bundle names are immutable; package a new version so it uploads gzipped.`,
        );
      }
      if (head.Metadata?.["sha256"] === bundle.info.sha256) {
        unchanged.push(bundle.info.file);
        continue;
      }
      throw new PublishRefused(
        `refusing the entire publish: ${bundle.info.file} already exists in the bucket with different or unrecorded ` +
          `content. Bundle names are immutable; package a new version instead of overwriting.`,
      );
    } catch (error) {
      if (error instanceof PublishRefused) throw error;
      if (!isNotFound(error)) throw error;
      toUpload.push(bundle);
    }
  }

  const uploaded: string[] = [];
  for (const bundle of toUpload) {
    const bytes = readFileSync(bundle.file);
    // Re-hashed at the moment of upload: the plan's check is worthless if the
    // file was rebuilt between planning and sending.
    if (sha256(bytes) !== bundle.info.sha256) {
      throw new PublishRefused(
        `refusing to continue: ${bundle.info.file} changed on disk after it was verified. ` +
          `Nothing past this point was uploaded and the manifest was not published.`,
      );
    }
    const body = bundle.gzip ? gzipTranslation(bytes) : bytes;
    const sizeProblem = downloadSizeProblem(bundle.info, body);
    if (sizeProblem !== null) {
      throw new PublishRefused(`refusing to continue: ${sizeProblem}. Nothing past this point was uploaded and the manifest was not published.`);
    }
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: bundle.info.file,
        Body: body,
        ContentType: "application/vnd.sqlite3",
        ...(bundle.gzip ? { ContentEncoding: "gzip" } : {}),
        CacheControl: "public, max-age=31536000, immutable",
        // The decompressed file's digest: what the app checks, and what the HEAD above compares.
        Metadata: { sha256: bundle.info.sha256 },
      }),
    );
    uploaded.push(bundle.info.file);
  }

  // Last, always. See the header.
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: MANIFEST_KEY,
      Body: readFileSync(plan.manifestFile),
      ContentType: "application/json",
      CacheControl: "no-cache",
    }),
  );
  uploaded.push(MANIFEST_KEY);

  return { plan, uploaded, unchanged, dryRun: false };
}

export function formatBytes(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function totalBytes(plan: PublishPlan): number {
  return plan.bundles.reduce((sum, b) => sum + statSync(b.file).size, 0);
}

/**
 * @yada/pipeline — STUB.
 *
 * Will hold the CLI stages of build plan §3: ingest, normalize, derive,
 * generate, adversary, validate, review, package, publish, regress. Nothing
 * here talks to an API yet.
 */

import { SCHEMA_VERSION } from "@yada/schema";

export const PIPELINE_STAGES = [
  "ingest",
  "normalize",
  "derive",
  "generate",
  "adversary",
  "validate",
  "review",
  "package",
  "publish",
  "regress",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export function describePipeline(): string {
  return `yada pipeline (schema ${SCHEMA_VERSION}): ${PIPELINE_STAGES.join(" -> ")}`;
}

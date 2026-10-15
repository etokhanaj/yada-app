/**
 * Book introductions (build 6, item G): the Understand file's meta `book_intro`, written by the pipeline
 * from tN's front:intro (packages/pipeline/src/understand/intro.ts). Shown only once John approved the
 * paragraph (rule 2): a flagged one is held back, as a flagged summary is (EG-01).
 */

export interface BookIntro {
  readonly text: string;
  /** Says it was shortened and names the licence, as CC BY-SA asks. */
  readonly credit: string;
}

export function parseBookIntro(raw: string | null | undefined): BookIntro | null {
  if (raw === null || raw === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { text, credit, status } = value as Record<string, unknown>;
  if (status !== "approved" || typeof text !== "string" || text.trim() === "" || typeof credit !== "string" || credit.trim() === "") return null;
  return { text, credit };
}

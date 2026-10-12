/**
 * Go further's second lines (canvas SN-09): every row is the same object, its name and one muted
 * line that says what is behind it, counted from the data. Pure, so it can be tested.
 */

/** "17 words · 6 grammar notes", or "13 words, each with its English" when there are no notes. */
export function originalLine(words: number, grammarNotes: number): string {
  const w = `${words} ${words === 1 ? "word" : "words"}`;
  if (grammarNotes === 0) return `${w}, each with its English`;
  return `${w} · ${grammarNotes} grammar ${grammarNotes === 1 ? "note" : "notes"}`;
}

/** "BSB, WEB, KJV, LSV": the versions Compare will set side by side, the reader's own first. */
export function compareLine(order: readonly string[]): string {
  return order.join(", ");
}

/** "Passage guide · 1:1–18" under the passage's title. */
export function passageLine(range: string): string {
  return `Passage guide · ${range}`;
}

/** "Tyndale · 2 notes" under Study notes. */
export function studyNotesLine(n: number): string {
  return `Tyndale · ${n} ${n === 1 ? "note" : "notes"}`;
}

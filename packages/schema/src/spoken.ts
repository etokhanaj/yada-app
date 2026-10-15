/**
 * What a voice says before a chapter (build 6, spoken chapter names): "John, chapter three", "First Samuel,
 * chapter one", "Psalm twenty-three". One source for both voices: the pipeline records these words
 * (`yada audio-titles`), and the app's iPhone voice speaks the same words where no recording reads.
 */

import { BOOK_CODES, type BookCode } from "./refs.js";

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 1–150 in words, so a title never depends on how Kokoro chooses to read digits ("1 Samuel"). */
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 199) throw new RangeError(`${n} is outside the chapters`);
  if (n >= 100) return n === 100 ? "one hundred" : `one hundred and ${numberWords(n - 100)}`;
  if (n < 20) return ONES[n] ?? "";
  const ones = n % 10;
  return ones === 0 ? (TENS[n / 10] ?? "") : `${TENS[Math.floor(n / 10)]}-${ONES[ones]}`;
}

const ORDINALS: Record<string, string> = { "1": "First", "2": "Second", "3": "Third" };

/** What the voice says before a chapter: "John, chapter three", "First Samuel, chapter one", "Psalm twenty-three". */
export function spokenTitle(book: BookCode, chapter: number): string {
  if (book === "PSA") return `Psalm ${numberWords(chapter)}`;
  const name = BOOK_CODES[book].name.replace(/^([123]) /, (_, d: string) => `${ORDINALS[d]} `);
  return `${name}, chapter ${numberWords(chapter)}`;
}

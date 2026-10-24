/**
 * BibleProject's book overview videos (OR-03, OR-06, OR-09). BibleProject confirmed on 19 Oct 2026 that linking to
 * them in an in-app browser is within their Terms, with the credit below (docs/decisions-2026-10-22.md). Each address
 * and length was read from bibleproject.com on 22 Oct 2026; a book is added only once its page is checked, never by
 * guessing the address. Yada links to the page; it never downloads or embeds the video.
 */

import type { BookCode } from "@yada/schema";

/** BibleProject's wording, as they asked for it. */
export const BIBLEPROJECT_CREDIT = "BibleProject is the author and owner of this content. To find more BibleProject resources, visit bibleproject.com.";

export interface Overview {
  readonly url: string;
  /** Seconds, from the page's own video data. */
  readonly seconds: number;
}

const page = (slug: string, seconds: number): Overview => ({ url: `https://bibleproject.com/videos/${slug}/`, seconds });
const LETTERS_OF_JOHN = [page("1-3-john", 576)];

const OVERVIEWS: Partial<Record<BookCode, readonly Overview[]>> = {
  MRK: [page("mark", 572)],
  JHN: [page("john-1-12", 526), page("john-13-21", 512)],
  "1JN": LETTERS_OF_JOHN,
  "2JN": LETTERS_OF_JOHN,
  "3JN": LETTERS_OF_JOHN,
};

export function overviewsFor(book: BookCode): readonly Overview[] {
  return OVERVIEWS[book] ?? [];
}

/** "9 min": the length rounded to the minute, as the card shows it. */
export function minutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

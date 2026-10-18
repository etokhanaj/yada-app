/**
 * Contents' book order (CT-01, CT-02): Traditional, the testaments in canonical order, or A to Z, one list with
 * no testament headings, where a number sorts by the name after it ("1 John under J", CT-02's caption).
 */

import { BOOK_CODES, BOOK_ORDER, type BookCode } from "@yada/schema";

export type BookOrder = "traditional" | "az";

export function isBookOrder(value: string | undefined): value is BookOrder {
  return value === "traditional" || value === "az";
}

/** "1 Corinthians" → ["corinthians", 1]: the name, then the number that only orders books of one name. */
function sortKey(book: BookCode): [string, number] {
  const name = BOOK_CODES[book].name;
  const m = /^(\d+)\s+(.*)$/u.exec(name);
  return m === null ? [name.toLowerCase(), 0] : [(m[2] ?? "").toLowerCase(), Number(m[1])];
}

export function booksAtoZ(books: readonly BookCode[] = BOOK_ORDER): BookCode[] {
  return [...books].sort((a, b) => {
    const [na, ia] = sortKey(a);
    const [nb, ib] = sortKey(b);
    return na.localeCompare(nb, "en") || ia - ib;
  });
}

/**
 * The groups Contents lists. Traditional puts the testament being read first, as the canvas draws it from
 * 1 Corinthians (C-01); A to Z is one untitled group.
 */
export function contentsGroups(order: BookOrder, current: BookCode | null): Array<{ title: string | null; books: BookCode[] }> {
  if (order === "az") return [{ title: null, books: booksAtoZ() }];
  const groups = [
    { title: "Old Testament", books: BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "OT") },
    { title: "New Testament", books: BOOK_ORDER.filter((b) => BOOK_CODES[b].testament === "NT") },
  ];
  if (current !== null && BOOK_CODES[current].testament === "NT") groups.reverse();
  return groups;
}

import type { BookCode } from "@yada/schema";

import { useQuery } from "../../data/AppData";
import { loadPericopes } from "../../data/understand";
import type { PericopeRow } from "../../lib/pericopes";

/** The book's passages (empty where the book has no bundle yet). */
export function usePericopes(book: BookCode | undefined): readonly PericopeRow[] {
  const { data } = useQuery(async () => (book === undefined ? [] : loadPericopes(book)), [book]);
  return data ?? [];
}

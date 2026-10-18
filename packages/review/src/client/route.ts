/**
 * The hash route and the entry shortcuts, kept free of React and the DOM so
 * they can be tested in Node.
 */

import { isReviewQueue, type ReviewQueue } from "../shared/api";

export const DEBATES_HASH = "#/debates";
export const SUMMARIES_HASH = "#/summaries";
export const EXTRACTS_HASH = "#/extracts";
export const REPORTS_HASH = "#/reports";

export type Route =
  | { view: "debates" }
  | { view: "extracts" }
  | { view: "reports" }
  | { view: "summaries"; passageId: string | null }
  | { view: "queue"; queue: ReviewQueue; verseId: string | null };

export function routeFromHash(hash: string): Route {
  const [, first, second] = hash.replace(/^#/, "").split("/");
  if (first === "debates") return { view: "debates" };
  if (first === "extracts") return { view: "extracts" };
  if (first === "reports") return { view: "reports" };
  let id: string | null = null;
  if (second !== undefined && second !== "") {
    try {
      id = decodeURIComponent(second);
    } catch {
      id = null;
    }
  }
  if (first === "summaries") return { view: "summaries", passageId: id };
  return { view: "queue", queue: isReviewQueue(first) ? first : "flagged", verseId: id };
}

export function hashFor(route: Route): string {
  if (route.view === "debates") return DEBATES_HASH;
  if (route.view === "extracts") return EXTRACTS_HASH;
  if (route.view === "reports") return REPORTS_HASH;
  if (route.view === "summaries") {
    return route.passageId === null ? SUMMARIES_HASH : `${SUMMARIES_HASH}/${encodeURIComponent(route.passageId)}`;
  }
  return `#/${route.queue}${route.verseId === null ? "" : `/${encodeURIComponent(route.verseId)}`}`;
}

export type EntryShortcut =
  | { kind: "move"; delta: 1 | -1 }
  | { kind: "decide"; action: "approve" | "reject" }
  | { kind: "rate"; rating: number };

/**
 * What a key press does to the staging entry on screen. On the debates and
 * summaries views there is no entry on screen, so every key does nothing: a
 * stray `a` there once risked approving an entry John could not see.
 */
export function entryShortcut(view: Route["view"], key: string, modified: boolean): EntryShortcut | null {
  if (view !== "queue" || modified) return null;
  switch (key) {
    case "j":
      return { kind: "move", delta: 1 };
    case "k":
      return { kind: "move", delta: -1 };
    case "a":
      return { kind: "decide", action: "approve" };
    case "r":
      return { kind: "decide", action: "reject" };
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
      return { kind: "rate", rating: Number(key) };
    default:
      return null;
  }
}

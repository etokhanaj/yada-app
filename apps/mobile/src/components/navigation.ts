/**
 * Moving between reading and the layers under it, always reversibly.
 *
 * Depth (brief §1): the reader (0), Understand (1, a sheet), and the evidence
 * sheet (2), which pushes inside itself and is never followed by a third.
 * Each sheet is a route group with its own stack, so "back" inside a sheet
 * and "close the sheet" are different navigators: the nearest stack, and the
 * root stack the sheets sit on.
 */

import type { BookCode } from "@yada/schema";
import { router, useNavigation, usePathname, useRoute } from "expo-router";
import { useCallback } from "react";

import { LEAVE_ROUTES, SHEET_ROUTES, trailingSheets } from "../lib/backToReading";

export interface ReaderTarget {
  readonly book: BookCode;
  readonly chapter: number;
  readonly verse?: number;
  /** Verse id the reader came from; the reader's back control names it. */
  readonly from?: string;
  /** Select the target verse on arrival, so its actions are one tap away. */
  readonly select?: boolean;
  /**
   * With `select`, the last verse of a range in the same chapter: a See also row for John
   * 3:19–20 arrives with both verses selected (canvas SN-07).
   */
  readonly to?: number;
  /**
   * Resuming a saved position (brief §8.18): the verse sits just below the
   * header, where it was being read, not a fifth of the way down where a jump
   * leaves room above a selection.
   */
  readonly resume?: boolean;
  /** A pericope id whose guide opens over the text on arrival (Start here, Home's Next; ON-02). */
  readonly guide?: string;
  /** MM-05: the verse last read, held in the bar for two seconds (Home after a gap). */
  readonly hold?: number;
  /**
   * The page the reader returns to, for its back control: "Bookmarks", "Recent", a plan. Without it the
   * control said "Home" while going back to the page that opened it (IA stress test, 15 Oct 2026).
   */
  readonly back?: string;
}

export function readerHref(target: ReaderTarget) {
  const params: Record<string, string> = { book: target.book, chapter: String(target.chapter) };
  if (target.verse !== undefined) params["verse"] = String(target.verse);
  if (target.from !== undefined) params["from"] = target.from;
  if (target.select === true) params["select"] = "1";
  if (target.hold !== undefined) params["hold"] = String(target.hold);
  if (target.select === true && target.to !== undefined && target.to !== target.verse) params["to"] = String(target.to);
  if (target.resume === true) params["resume"] = "1";
  if (target.guide !== undefined) params["guide"] = target.guide;
  if (target.back !== undefined) params["back"] = target.back;
  return { pathname: "/read/[book]/[chapter]" as const, params };
}

/**
 * A door from outside the app (IA-13): a notification, Siri, Spotlight or a widget. Every door lands the same
 * way: whatever is open closes (sheets, the full player; audio keeps playing) and the reader opens at depth 0
 * over Home. Before, each door stacked differently and a widget link could put a second reader over the first
 * (IA stress test, 15 Oct 2026).
 */
export function openFromOutside(target: ReaderTarget | null): void {
  // A cold launch through /open has nothing beneath it: the door replaces it, or a widget tap after the app was
  // killed left an empty page (review, 15 Oct 2026). The reader's ‹ Home replaces itself with Home.
  if (!router.canDismiss()) {
    router.replace(target === null ? "/" : readerHref(target));
    return;
  }
  router.dismissAll();
  if (target !== null) router.push(readerHref(target));
}

/** A widget's link: `/open` hands its target to openFromOutside, so a widget lands as every other door. */
export function openHref(book: string, chapter: number, verse: number): string {
  return `studio.yada.reader:///open?book=${book}&chapter=${chapter}&verse=${verse}`;
}

interface NavigatorLike {
  getState(): { key: string; routes?: Array<{ name: string; key: string }> } | undefined;
  getParent(): NavigatorLike | undefined;
  canGoBack(): boolean;
  goBack(): void;
  dispatch(action: { type: string; payload?: unknown; target?: string }): void;
}

/**
 * The stack the sheets are presented on: the outermost navigator, this one or
 * above, whose routes include a sheet. Not simply the top one: expo-router
 * wraps the root Stack in its own container, and a POP sent there does nothing.
 * Not the nearest either: a sheet's own stack can hold a screen named like a
 * root sheet (evidence/translations beside the root Translations sheet), and
 * popping that stack leaves every sheet open.
 */
function hostOf(navigation: NavigatorLike): NavigatorLike {
  let host = navigation;
  for (let at: NavigatorLike | undefined = navigation; at !== undefined; at = at.getParent()) {
    if (at.getState()?.routes?.some((r) => SHEET_ROUTES.has(r.name)) === true) host = at;
  }
  return host;
}

function popHost(navigation: NavigatorLike, count: number): void {
  const host = hostOf(navigation);
  const key = host.getState()?.key;
  if (count > 0 && key !== undefined) host.dispatch({ type: "POP", payload: { count }, target: key });
}

export function useSheetNav(): {
  /** Close every sheet: the reader underneath never moved. */
  backToReading: () => void;
  /** Close only the sheet this screen is in (evidence → Understand; Understand → reading). */
  closeSheet: () => void;
  /** Back one screen inside this sheet, when there is one. */
  back: (() => void) | null;
  /** Back one depth, whatever it is: VoiceOver's escape (brief §1 rule 6). */
  escape: () => void;
  /** Leave the sheets and read somewhere else; the reader's back returns here. */
  jumpTo: (target: ReaderTarget) => void;
} {
  const navigation = useNavigation() as unknown as NavigatorLike;
  const route = useRoute();
  const routes = () => hostOf(navigation).getState()?.routes?.map((r) => r.name) ?? [];
  // canGoBack() bubbles to the parent navigator, so it is true on a sheet's
  // first screen too; only the sheet stack's own routes say there is a screen behind.
  // This screen's own place in that stack, not the stack's length: the guide re-rendered while a
  // verse's Understand sat on top of it (a theme change) counted two routes, and kept a ‹ that
  // led nowhere once that verse was popped (QA, ON-04, 11 Oct 2026).
  const inSheetStack =
    navigation.getParent() !== undefined && (navigation.getState()?.routes?.findIndex((r) => r.key === route.key) ?? 0) > 0;

  const backToReading = useCallback(() => {
    const count = trailingSheets(routes());
    if (count > 0) popHost(navigation, count);
    else if (router.canGoBack()) router.back();
  }, [navigation]);
  const closeSheet = useCallback(() => popHost(navigation, 1), [navigation]);
  const back = inSheetStack ? () => navigation.goBack() : null;
  const escape = useCallback(() => {
    if (inSheetStack) navigation.goBack();
    else popHost(navigation, 1);
  }, [navigation, inSheetStack]);
  const jumpTo = useCallback(
    (target: ReaderTarget) => {
      popHost(navigation, trailingSheets(routes(), LEAVE_ROUTES));
      router.push(readerHref(target));
    },
    [navigation],
  );
  return { backToReading, closeSheet, back, escape, jumpTo };
}

/**
 * Pages inside a sheet push within the sheet they were opened in: the passage guide's own stack, or
 * Understand's. A push to the other would stack a second sheet (brief §1 rule 2: two sheets at most).
 */
export function useSheetBase(): "/guide" | "/understand" {
  return usePathname().startsWith("/guide") ? "/guide" : "/understand";
}

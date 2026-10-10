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
import { router, useNavigation } from "expo-router";
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
}

export function readerHref(target: ReaderTarget) {
  const params: Record<string, string> = { book: target.book, chapter: String(target.chapter) };
  if (target.verse !== undefined) params["verse"] = String(target.verse);
  if (target.from !== undefined) params["from"] = target.from;
  if (target.select === true) params["select"] = "1";
  return { pathname: "/read/[book]/[chapter]" as const, params };
}

interface NavigatorLike {
  getState(): { key: string; routes?: Array<{ name: string }> } | undefined;
  getParent(): NavigatorLike | undefined;
  canGoBack(): boolean;
  goBack(): void;
  dispatch(action: { type: string; payload?: unknown; target?: string }): void;
}

/**
 * The stack the sheets are presented on: the nearest navigator, this one or
 * above, whose routes include a sheet. Not simply the top one: expo-router
 * wraps the root Stack in its own container, and a POP sent there does nothing.
 */
function hostOf(navigation: NavigatorLike): NavigatorLike {
  for (let at: NavigatorLike | undefined = navigation; at !== undefined; at = at.getParent()) {
    if (at.getState()?.routes?.some((r) => SHEET_ROUTES.has(r.name)) === true) return at;
  }
  return navigation;
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
  const routes = () => hostOf(navigation).getState()?.routes?.map((r) => r.name) ?? [];
  // canGoBack() bubbles to the parent navigator, so it is true on a sheet's
  // first screen too; only the sheet stack's own routes say there is a screen behind.
  const inSheetStack = navigation.getParent() !== undefined && (navigation.getState()?.routes?.length ?? 1) > 1;

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

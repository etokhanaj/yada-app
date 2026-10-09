/**
 * Moving between reading and the layers under it, always reversibly.
 */

import type { BookCode } from "@yada/schema";
import { router, useNavigation } from "expo-router";
import { useCallback } from "react";

import { trailingSheets } from "../lib/backToReading";

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

interface StackLike {
  getState(): { routes?: Array<{ name: string }> } | undefined;
}

function routeNames(navigation: StackLike): string[] {
  const state = navigation.getState();
  return state?.routes?.map((r) => r.name) ?? [];
}

export function useSheetNav(): {
  /** Pop every sheet on the stack: the reader underneath never moved. */
  backToReading: () => void;
  /** Leave the sheets and read somewhere else; the reader's back returns here. */
  jumpTo: (target: ReaderTarget) => void;
} {
  const navigation = useNavigation() as unknown as StackLike;
  const backToReading = useCallback(() => {
    const count = trailingSheets(routeNames(navigation));
    if (count > 0) router.dismiss(count);
    else if (router.canGoBack()) router.back();
  }, [navigation]);
  const jumpTo = useCallback(
    (target: ReaderTarget) => {
      const count = trailingSheets(routeNames(navigation));
      if (count > 0) router.dismiss(count);
      router.push(readerHref(target));
    },
    [navigation],
  );
  return { backToReading, jumpTo };
}

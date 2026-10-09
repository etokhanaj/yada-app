/**
 * When a search counts as one search for the PRD §14 `search` event.
 *
 * Results refresh 180ms after each keystroke, and the event used to be logged
 * on every refresh, so typing "shepherd" logged up to eight searches. A query
 * is now logged once, when it settles: the reader stops typing for
 * SEARCH_SETTLE_MS, presses Search, or opens a result. The same query is not
 * logged twice in a row, so settling and then opening a result counts once.
 */

export const SEARCH_SETTLE_MS = 1500;

export interface SearchLogger {
  /** The query on screen changed; "" clears it. */
  typed(query: string, detail: string): void;
  /** Search pressed or a result opened: log now instead of waiting. */
  settle(): void;
  /** The screen is going away; a query nobody waited for is not logged. */
  dispose(): void;
}

export function createSearchLogger(log: (detail: string) => void): SearchLogger {
  let pending: { query: string; detail: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastLogged: string | null = null;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const settle = () => {
    cancel();
    if (pending === null) return;
    if (pending.query !== lastLogged) {
      log(pending.detail);
      lastLogged = pending.query;
    }
    pending = null;
  };

  return {
    typed(query, detail) {
      cancel();
      if (query === "") {
        // Clearing the field ends that search; typing it again is a new one.
        pending = null;
        lastLogged = null;
        return;
      }
      pending = { query, detail };
      timer = setTimeout(settle, SEARCH_SETTLE_MS);
    },
    settle,
    dispose() {
      cancel();
      pending = null;
    },
  };
}

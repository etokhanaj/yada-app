import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSearchLogger, SEARCH_SETTLE_MS } from "./searchLog";

describe("search event logging", () => {
  let logged: string[];
  beforeEach(() => {
    vi.useFakeTimers();
    logged = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const type = (logger: ReturnType<typeof createSearchLogger>, word: string) => {
    for (let i = 1; i <= word.length; i++) {
      logger.typed(word.slice(0, i), "latin");
      vi.advanceTimersByTime(200);
    }
  };

  // The incident: the event fired on every results refresh, so typing
  // "shepherd" letter by letter logged eight searches.
  it("logs a typed word once, after it settles", () => {
    const logger = createSearchLogger((detail) => logged.push(detail));
    type(logger, "shepherd");
    expect(logged).toEqual([]);
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    expect(logged).toEqual(["latin"]);
  });

  it("logs at once on submit or when a result is opened, and not again when the timer would fire", () => {
    const logger = createSearchLogger((detail) => logged.push(detail));
    logger.typed("jn 3 16", "reference");
    logger.settle();
    expect(logged).toEqual(["reference"]);
    vi.advanceTimersByTime(SEARCH_SETTLE_MS * 2);
    logger.settle();
    expect(logged).toEqual(["reference"]);
  });

  it("does not log the same query twice in a row", () => {
    const logger = createSearchLogger((detail) => logged.push(detail));
    logger.typed("love", "latin");
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    logger.typed("lov", "latin");
    logger.typed("love", "latin");
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    expect(logged).toEqual(["latin"]);
  });

  it("logs a changed query, and the same query again after the field was cleared", () => {
    const logger = createSearchLogger((detail) => logged.push(detail));
    logger.typed("love", "latin");
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    logger.typed("λόγος", "greek");
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    logger.typed("", "latin");
    logger.typed("λόγος", "greek");
    logger.settle();
    expect(logged).toEqual(["latin", "greek", "greek"]);
  });

  it("logs nothing for an empty field or a screen left before the query settled", () => {
    const logger = createSearchLogger((detail) => logged.push(detail));
    logger.typed("", "latin");
    logger.settle();
    logger.typed("grace", "latin");
    logger.dispose();
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    expect(logged).toEqual([]);
  });
});

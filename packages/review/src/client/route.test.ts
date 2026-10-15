import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "./App";
import { entryShortcut, hashFor, routeFromHash } from "./route";

/** Renders the first frame App draws for a URL hash. Effects do not run, so nothing is fetched. */
function firstFrame(hash: string): string {
  Object.defineProperty(globalThis, "window", {
    value: { location: { hash } },
    configurable: true,
    writable: true,
  });
  return renderToString(createElement(App));
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("hash route", () => {
  it("reads #/debates as the debates view", () => {
    expect(routeFromHash("#/debates")).toEqual({ view: "debates" });
    expect(routeFromHash("#/flagged/JHN.1.1")).toEqual({ view: "queue", queue: "flagged", verseId: "JHN.1.1" });
    expect(routeFromHash("")).toEqual({ view: "queue", queue: "flagged", verseId: null });
    expect(routeFromHash("#/flagged/%E0%A4%A")).toEqual({ view: "queue", queue: "flagged", verseId: null });
  });

  it("reads #/extracts as the extracts view, and loads there with no entry list", () => {
    expect(routeFromHash("#/extracts")).toEqual({ view: "extracts" });
    const html = firstFrame("#/extracts");
    expect(html).toMatch(/aria-current="true"[^>]*><span>Extracts<\/span>/);
    expect(html).not.toContain("Nothing in this queue.");
  });

  it("writes back the hash it reads", () => {
    for (const hash of ["#/debates", "#/extracts", "#/random_sample", "#/targeted_expert/1CO.14.34"]) {
      expect(hashFor(routeFromHash(hash))).toBe(hash);
    }
  });

  it("loading at #/debates selects the debates queue, not the entry view", () => {
    const html = firstFrame("#/debates");
    expect(html).toMatch(/aria-current="true"[^>]*><span>Debate positions<\/span>/);
    expect(html).not.toContain("Nothing selected.");
    expect(html).not.toContain("Nothing in this queue.");
  });
});

describe("summaries route", () => {
  it("reads and writes #/summaries with an optional passage", () => {
    expect(routeFromHash("#/summaries")).toEqual({ view: "summaries", passageId: null });
    expect(routeFromHash("#/summaries/DEU.1.1-1.8")).toEqual({ view: "summaries", passageId: "DEU.1.1-1.8" });
    for (const hash of ["#/summaries", "#/summaries/DEU.1.1-1.8"]) expect(hashFor(routeFromHash(hash))).toBe(hash);
  });

  it("loading at #/summaries selects that queue, with no entry decision bar", () => {
    const html = firstFrame("#/summaries");
    expect(html).toMatch(/aria-current="true"[^>]*><span>Passage summaries<\/span>/);
    expect(html).not.toContain('aria-label="Decision"');
    expect(html).not.toContain("a approve");
  });
});

describe("entry decision bar", () => {
  it("is not rendered on the debates view", () => {
    const html = firstFrame("#/debates");
    expect(html).not.toContain('aria-label="Decision"');
    expect(html).not.toContain('aria-label="Rating"');
    expect(html).not.toContain("<kbd>a</kbd>");
    expect(html).not.toContain("a approve");
  });

  it("is rendered on an entry queue", () => {
    const html = firstFrame("#/flagged");
    expect(html).toContain('aria-label="Decision"');
    expect(html).toContain('aria-label="Rating"');
  });
});

describe("entry shortcuts", () => {
  const keys = ["a", "r", "j", "k", "1", "2", "3", "4", "5"];

  it("do nothing on the debates, summaries and extracts views", () => {
    for (const key of keys) {
      expect(entryShortcut("debates", key, false)).toBeNull();
      expect(entryShortcut("debates", key, true)).toBeNull();
      expect(entryShortcut("summaries", key, false)).toBeNull();
      expect(entryShortcut("extracts", key, false)).toBeNull();
    }
  });

  it("act on an entry queue", () => {
    expect(entryShortcut("queue", "a", false)).toEqual({ kind: "decide", action: "approve" });
    expect(entryShortcut("queue", "r", false)).toEqual({ kind: "decide", action: "reject" });
    expect(entryShortcut("queue", "j", false)).toEqual({ kind: "move", delta: 1 });
    expect(entryShortcut("queue", "4", false)).toEqual({ kind: "rate", rating: 4 });
    expect(entryShortcut("queue", "a", true)).toBeNull();
  });
});

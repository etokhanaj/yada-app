import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let dismissable = true;
vi.mock("expo-router", () => ({
  router: {
    canDismiss: () => dismissable,
    dismissAll: () => calls.push("dismissAll"),
    replace: (href: string | { params: Record<string, string> }) => calls.push(`replace ${typeof href === "string" ? href : JSON.stringify(href.params)}`),
    push: (href: { pathname: string; params: Record<string, string> }) => calls.push(`push ${JSON.stringify(href.params)}`),
  },
  useNavigation: () => null,
  usePathname: () => "/",
  useRoute: () => null,
}));
vi.mock("../lib/backToReading", () => ({ LEAVE_ROUTES: new Set(), SHEET_ROUTES: new Set(), trailingSheets: () => 0 }));

const { openFromOutside, openHref, readerHref } = await import("./navigation");

beforeEach(() => {
  calls.length = 0;
  dismissable = true;
});

describe("readerHref", () => {
  it("names the page underneath for the reader's back control (IA stress test, 15 Oct 2026)", () => {
    expect(readerHref({ book: "JHN", chapter: 3, verse: 16, select: true, back: "Bookmarks" }).params).toEqual({
      book: "JHN",
      chapter: "3",
      verse: "16",
      select: "1",
      back: "Bookmarks",
    });
  });
});

describe("doors from outside (IA-13)", () => {
  it("close whatever is open, then open the reader", () => {
    openFromOutside({ book: "PSA", chapter: 23, verse: 1, resume: true });
    expect(calls).toEqual(["dismissAll", `push ${JSON.stringify({ book: "PSA", chapter: "23", verse: "1", resume: "1" })}`]);
  });

  it("on a cold launch, replace the empty /open page with the reader", () => {
    dismissable = false;
    openFromOutside({ book: "JHN", chapter: 1 });
    expect(calls).toEqual([`replace ${JSON.stringify({ book: "JHN", chapter: "1" })}`]);
  });

  it("on a cold launch with no place, land on Home", () => {
    dismissable = false;
    openFromOutside(null);
    expect(calls).toEqual(["replace /"]);
  });

  it("with no place, land on Home", () => {
    openFromOutside(null);
    expect(calls).toEqual(["dismissAll"]);
  });

  it("send a widget through the same door", () => {
    expect(openHref("JHN", 3, 16)).toBe("studio.yada.reader:///open?book=JHN&chapter=3&verse=16");
  });
});

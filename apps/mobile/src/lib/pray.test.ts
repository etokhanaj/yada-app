import { describe, expect, it } from "vitest";

import { askedLine, daysLeft, helplineFor, inviteLine, listItemLine, mentionsSelfHarm, mineLine, offerable, parseList, peopleLine, prayedLine, regionName, requestLine } from "./pray";

const day = 86_400_000;

describe("Pray for others", () => {
  it("counts the days a request has left and says when it ended or was answered", () => {
    expect(daysLeft(10 * day, 3 * day)).toBe(7);
    expect(requestLine({ expiresAt: 10 * day }, 9.5 * day)).toBe("Live · 1 day left");
    expect(requestLine({ expiresAt: 10 * day }, 11 * day)).toBe("Ended");
    expect(requestLine({ expiresAt: 10 * day, answeredAt: new Date(2026, 9, 12).getTime() }, 0)).toBe("Answered 12 Oct");
  });

  it("never shows 0 prayed (XT-04)", () => {
    expect(prayedLine(0)).toBeNull();
    expect(prayedLine(undefined)).toBeNull();
    expect(prayedLine(4)).toBe("4 prayed");
  });

  it("notices self-harm, and names only lines it is sure of (PR-12)", () => {
    expect(mentionsSelfHarm("I don't want to live any more")).toBe(true);
    expect(mentionsSelfHarm("Please pray for my sister's exams")).toBe(false);
    expect(helplineFor("GB")).toMatchObject({ name: "Samaritans", call: "116 123" });
    expect(helplineFor("US").call).toBe("988");
    expect(helplineFor("FR")).toEqual({ name: "Find A Helpline", call: null, url: "https://findahelpline.com/fr" });
  });

  it("never offers a request you prayed for or one from someone you blocked (XT-03)", () => {
    const list = [{ id: "a", creator: "x" }, { id: "b", creator: "y" }, { id: "c", creator: "z" }];
    expect(offerable(list, new Set(["a"]), new Set(["z"])).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("circles", () => {
  it("names its people, and a new circle is just you", () => {
    expect(peopleLine(1)).toBe("Just you");
    expect(peopleLine(5)).toBe("5 people");
  });
  it("offers Invite until 12, then hides it", () => {
    expect(inviteLine(5)).toBe("5 of 12");
    expect(inviteLine(11)).toBe("11 of 12");
    expect(inviteLine(12)).toBeNull();
  });
});

describe("Pray for someone and Your requests (PR-09, PR-11, PR-12)", () => {
  const DAY = 86_400_000;
  const now = Date.UTC(2026, 9, 18, 12);
  it("says who asked and when, only what is known", () => {
    expect(askedLine("Anna", now - 2 * DAY, now)).toBe("Anna · 2 days ago");
    expect(askedLine("", now - 1 * DAY, now)).toBe("Yesterday");
    expect(askedLine("Anna", undefined, now)).toBe("Anna");
    expect(askedLine(" ", undefined, now)).toBeNull();
  });
  it("puts how many prayed first on a live request, the date first on an answered one, never 0", () => {
    expect(mineLine({ expiresAt: now + 5 * DAY, prayed: 3 }, now)).toBe("3 people prayed · 5 days left");
    expect(mineLine({ expiresAt: now + 5 * DAY, prayed: 0 }, now)).toBe("5 days left");
    expect(mineLine({ expiresAt: now + 5 * DAY, prayed: 1 }, now)).toBe("1 person prayed · 5 days left");
    expect(mineLine({ expiresAt: now, answeredAt: Date.UTC(2026, 9, 12, 12), prayed: 7 }, now)).toBe("Answered 12 Oct · 7 people prayed");
  });
  it("names the region for More helplines", () => {
    expect(regionName("GB")).toBe("the UK");
    expect(regionName("NG")).toBe("Nigeria");
    expect(regionName(null)).toBeNull();
  });
});

describe("your private list (PR-07)", () => {
  it("dates each item by when it was added or answered, and invents no date for an old one", () => {
    const added = new Date(2026, 9, 2).getTime();
    const answered = new Date(2026, 9, 12).getTime();
    expect(listItemLine({ text: "Peace for my brother", added })).toBe("Added 2 Oct");
    expect(listItemLine({ text: "Mum’s surgery", added, answered })).toBe("Answered 12 Oct");
    expect(listItemLine({ text: "Saved before build 10" })).toBeNull();
  });

  it("reads lists saved as plain strings and as dated items, dropping anything else", () => {
    expect(parseList(JSON.stringify(["Old", { text: "New", added: 5 }, { text: "Done", added: 1, answered: 9 }, 7, { added: 3 }]))).toEqual([
      { text: "Old" },
      { text: "New", added: 5 },
      { text: "Done", added: 1, answered: 9 },
    ]);
    expect(parseList(undefined)).toEqual([]);
    expect(parseList("not json")).toEqual([]);
    expect(parseList(JSON.stringify({ text: "x" }))).toEqual([]);
  });
});

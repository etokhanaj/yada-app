import { describe, expect, it } from "vitest";

import { answeredLines, deleteCircleLine, askedLine, parsePrayNotify, prayAgainAt, prayAgainLine, recentlyAnswered, daysLeft, hashIndex, helplineFor, initialOf, inviteLine, listItemLine, mentionsSelfHarm, mineLine, newestFirst, offerable, parseList, peopleLine, prayedLine, regionName, requestLine, waitingLine, withinTime, yoursLine, regionOf } from "./pray";

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
    // The region subtag, never the script's.
    expect(regionOf("en-GB")).toBe("GB");
    expect(regionOf("zh-Hant-TW")).toBe("TW");
    expect(regionOf("sr-Latn")).toBeNull();
    expect(regionOf("en")).toBeNull();
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

describe("Build 11 Pray helpers", () => {
  it("gives the same id the same index, and spreads ids across the hues", () => {
    expect(hashIndex("_abc", 6)).toBe(hashIndex("_abc", 6));
    const seen = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((x) => hashIndex(`user-${x}`, 6)));
    expect(seen.size).toBeGreaterThan(3);
  });
  it("never invents an initial", () => {
    expect([initialOf("sam"), initialOf("  "), initialOf("Ádá")]).toEqual(["S", null, "Á"]);
  });
  it("says how many wait, and nothing for none (XT-04)", () => {
    expect([waitingLine(0), waitingLine(1), waitingLine(4)]).toEqual([null, "1 request waiting", "4 requests waiting"]);
  });
  it("describes your own request without a zero", () => {
    const now = Date.UTC(2026, 9, 18);
    expect(yoursLine({ expiresAt: now + 5 * 86_400_000, prayed: 2 }, now)).toBe("Yours: 2 people prayed · 5 days left");
    expect(yoursLine({ expiresAt: now + 86_400_000, prayed: 0 }, now)).toBe("1 day left");
  });
});

describe("prayer notifications (PA-01 to PA-03, PC-23)", () => {
  it("has every switch on until one is turned off, and survives a bad value", () => {
    expect(parsePrayNotify(undefined)).toEqual({ answered: true, again: true, circles: true });
    expect(parsePrayNotify('{"again":false}')).toEqual({ answered: true, again: false, circles: true });
    expect(parsePrayNotify('{"circles":false}').circles).toBe(false);
    expect(parsePrayNotify("not json")).toEqual({ answered: true, again: true, circles: true });
  });

  it("sets Pray again for tomorrow at the reminder's time, and says when", () => {
    const at = prayAgainAt(new Date(2026, 9, 31, 22, 15), { hour: 7, minute: 5 });
    expect([at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([10, 1, 7, 5]);
    expect(prayAgainLine(at)).toBe("Tomorrow at 7:05, a reminder to pray for this again.");
  });

  it("keeps an answer for a week, newest first, and never one not answered", () => {
    const now = Date.UTC(2026, 9, 18);
    const day = 86_400_000;
    const list = [{ id: "a", answeredAt: now - 8 * day }, { id: "b" }, { id: "c", answeredAt: now - 2 * day }, { id: "d", answeredAt: now - day }];
    expect(recentlyAnswered(list, now).map((r) => r.id)).toEqual(["d", "c"]);
  });

  it("names the asker when there is a first name, and never says who else prayed", () => {
    const now = Date.UTC(2026, 9, 18);
    expect(answeredLines({ firstName: "Anna", answeredAt: now - 2 * 86_400_000 }, now)).toEqual({ title: "Anna’s request was answered", line: "You prayed for it · 2 days ago" });
    expect(answeredLines({ firstName: "", answeredAt: now }, now)).toEqual({ title: "A request you prayed for was answered", line: "Answered today" });
  });
});

describe("withinTime (circles waiting on iCloud)", () => {
  it("passes on an answer that comes in time", async () => {
    await expect(withinTime(Promise.resolve(3), 50)).resolves.toBe(3);
  });

  it("gives up once the time is up", async () => {
    await expect(withinTime(new Promise(() => undefined), 10)).rejects.toThrow("iCloud didn’t answer");
  });

  it("passes on a failure as it is", async () => {
    await expect(withinTime(Promise.reject(new Error("no account")), 50)).rejects.toThrow("no account");
  });
});

describe("deleteCircleLine (PC-06)", () => {
  it("names how many it ends for when others are in it", () => {
    expect(deleteCircleLine(3)).toBe("It ends for all 3 people, with every request in it. This can’t be undone.");
  });

  it("says no count when only you are in it", () => {
    expect(deleteCircleLine(1)).toBe("It ends with every request in it. This can’t be undone.");
  });
});

describe("Your requests on Pray (PR-51)", () => {
  it("puts the newest first and an undated one last", () => {
    const list = [{ id: "a", createdAt: 1 }, { id: "b" }, { id: "c", createdAt: 3 }];
    expect(newestFirst(list).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
});

import { describe, expect, it } from "vitest";

import { daysLeft, helplineFor, inviteLine, mentionsSelfHarm, offerable, peopleLine, prayedLine, requestLine } from "./pray";

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

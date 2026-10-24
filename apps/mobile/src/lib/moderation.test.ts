import { describe, expect, it } from "vitest";

import { mentionsSelfHarm } from "./pray";
import { refusal, refusalLine } from "./moderation";

describe("the filter before a request is posted (guideline 1.2)", () => {
  it("refuses profanity, slurs and abuse, however they are dressed up", () => {
    for (const text of ["What the fuck is going on", "FUCKING useless", "fuuuuck this", "f.u.c.k", "f*ck it all", "you f4gg0t", "kill yourself", "just KYS", "kys!", "go   die", "nigg@", "you're a retard"]) {
      expect(refusal(text), text).toBe("words");
    }
  });

  it("refuses links, which spam needs and a prayer request never does", () => {
    expect(refusal("Visit https://scam.example now")).toBe("link");
    expect(refusal("go to www.prize.win")).toBe("link");
    expect(refusal("cheap pills at pills4u.com")).toBe("link");
  });

  it("lets through ordinary words that contain a listed one, and the hard things people ask prayer for", () => {
    for (const text of [
      "Pray for my trip to Scunthorpe",
      "My assessment is on Friday",
      "Reading Dickens with my son",
      "Pray for Niger and its churches",
      "Our con artist landlord took the deposit",
      "Struggling with porn and want to be free",
      "Healing after a rape last year",
      "My brother is in an abusive marriage",
      "Help me through hell this week",
      "1 Kings 19 has been my comfort",
      "Graduated summa cum laude",
      "Amen!",
    ]) {
      expect(refusal(text), text).toBeNull();
    }
  });

  it("leaves self-harm to the helpline, which Ask shows first (PR-12)", () => {
    const text = "I want to kill myself";
    expect(mentionsSelfHarm(text)).toBe(true);
    expect(refusal(text)).toBeNull();
  });

  it("says why in one line", () => {
    expect(refusalLine("words")).toMatch(/aren’t allowed/);
    expect(refusalLine("link")).toMatch(/links/);
  });
});

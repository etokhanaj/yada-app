import { describe, expect, it } from "vitest";

import { askAddress, askMessage, asRequest, firstOf } from "./askSomeone";

describe("Ask someone (AO-02, AO-03)", () => {
  it("sends the request in the asker's words, then the link, in their own voice", () => {
    expect(askMessage(" Would you pray for my interview on Friday? ", "https://www.icloud.com/share/abc")).toBe(
      "Would you pray for my interview on Friday?\n\nI asked you on Yada, a free Bible app. Open this to tell me you prayed: https://www.icloud.com/share/abc",
    );
  });

  it("texts a phone number first, else mails, else says there is nowhere to send it", () => {
    expect(askAddress({ phones: ["+44 7700 900123"], emails: ["sam@example.com"] })).toEqual({ kind: "text", to: "+44 7700 900123" });
    expect(askAddress({ phones: [], emails: ["sam@example.com"] })).toEqual({ kind: "mail", to: "sam@example.com" });
    expect(askAddress({ phones: [], emails: [] })).toEqual({ kind: "none", to: "" });
  });

  it("uses the first name, or the whole name without one", () => {
    expect(firstOf({ name: "Sam Okafor", first: "Sam" })).toBe("Sam");
    expect(firstOf({ name: "Grandma", first: "" })).toBe("Grandma");
  });

  it("shapes an ask as one of Your requests: answered only when it was, someone when the name is lost", () => {
    const a = { id: "ask-1", text: "My interview", to: "Sam", createdAt: 1, expiresAt: 2, answeredAt: 0, prayed: 1 };
    expect(asRequest(a)).toEqual({ id: "ask-1", text: "My interview", createdAt: 1, expiresAt: 2, prayed: 1, to: "Sam" });
    expect(asRequest({ ...a, to: " ", answeredAt: 5 })).toMatchObject({ to: "someone", answeredAt: 5 });
  });
});

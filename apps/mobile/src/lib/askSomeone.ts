/**
 * Ask someone (Build 12 AO-01 to AO-04): the words that go in the message, pure so they are tested. The message goes
 * from the asker's own phone, so it speaks as them; the request is in their words, so the person can pray without
 * Yada; the link lets them say they prayed with it.
 */

export function askMessage(text: string, url: string): string {
  return `${text.trim()}\n\nI asked you on Yada, a free Bible app. Open this to tell me you prayed: ${url}`;
}

/** Where the message can go: a phone number for Messages first, else an email. */
export function askAddress(person: { phones: readonly string[]; emails: readonly string[] }): { kind: "text" | "mail" | "none"; to: string } {
  const phone = person.phones[0];
  if (phone !== undefined && phone.trim() !== "") return { kind: "text", to: phone };
  const email = person.emails[0];
  if (email !== undefined && email.trim() !== "") return { kind: "mail", to: email };
  return { kind: "none", to: "" };
}

/** "Sam" from "Sam Okafor": the first name the screens use, the whole name when there is no first. */
export function firstOf(person: { name: string; first: string }): string {
  return person.first.trim() !== "" ? person.first.trim() : person.name.trim();
}

/** An ask of one person, shaped as one of Your requests so it sits among them (PR-51): `to` names who was asked. */
export interface AskedRequest {
  readonly id: string;
  readonly text: string;
  readonly createdAt?: number;
  readonly expiresAt: number;
  readonly answeredAt?: number;
  readonly prayed?: number;
  readonly to?: string;
}

export function asRequest(a: { id: string; text: string; to: string; createdAt: number; expiresAt: number; answeredAt: number; prayed: number }): AskedRequest {
  return {
    id: a.id,
    text: a.text,
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
    prayed: a.prayed,
    to: a.to.trim() === "" ? "someone" : a.to,
    ...(a.answeredAt > 0 ? { answeredAt: a.answeredAt } : {}),
  };
}

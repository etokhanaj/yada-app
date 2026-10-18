/**
 * Pray for others, the rules (build 7 plan §2 row 18; PR-07–12, XT-03–05). Pure, so it is tested.
 *
 * - A request is at most 280 characters and lives 7 days; renewing starts the 7 days again.
 * - "N prayed" is the asker's alone, and never "0 prayed" (XT-04).
 * - A request the reader prayed for, or one from someone they blocked, never comes round again (XT-03).
 * - A request that mentions self-harm shows a helpline before it posts (PR-12). Only lines known to be right are named;
 *   everywhere else, Find A Helpline.
 */

export const ASK_MAX = 280;
export const HOLD_SECONDS = 20;

export function daysLeft(expiresAt: number, now: number): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 86_400_000));
}

/** "12 Oct", as PR-07 and PR-11 date things. */
function dayMonth(at: number): string {
  const d = new Date(at);
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`;
}

/** "Live · 7 days left", "Answered 12 Oct", "Ended": the line under a request of your own (PR-11). */
export function requestLine(r: { readonly expiresAt: number; readonly answeredAt?: number }, now: number): string {
  if (r.answeredAt !== undefined) return `Answered ${dayMonth(r.answeredAt)}`;
  const left = daysLeft(r.expiresAt, now);
  return left === 0 ? "Ended" : `Live · ${left} ${left === 1 ? "day" : "days"} left`;
}

/**
 * One thing on the private list (PR-07): its words, when it was added and, once the reader marks it, when it was
 * answered. Lists saved before build 10 are plain strings and have no dates; those show no date line rather than an
 * invented one.
 */
export interface ListItem {
  readonly text: string;
  readonly added?: number;
  readonly answered?: number;
}

/** "Added 2 Oct" or "Answered 12 Oct" under a list item (PR-07); nothing for an item saved without a date. */
export function listItemLine(item: ListItem): string | null {
  if (item.answered !== undefined) return `Answered ${dayMonth(item.answered)}`;
  return item.added === undefined ? null : `Added ${dayMonth(item.added)}`;
}

const time = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** The stored list, old plain strings and dated items alike; anything else is dropped. */
export function parseList(raw: string | undefined): ListItem[] {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): ListItem[] => {
    if (typeof x === "string") return [{ text: x }];
    if (x === null || typeof x !== "object" || typeof (x as { text?: unknown }).text !== "string") return [];
    const o = x as { text: string; added?: unknown; answered?: unknown };
    const added = time(o.added);
    const answered = time(o.answered);
    return [{ text: o.text, ...(added === undefined ? {} : { added }), ...(answered === undefined ? {} : { answered }) }];
  });
}

/** "4 prayed", or nothing before the first (XT-04). */
export function prayedLine(n: number | undefined): string | null {
  return n === undefined || n <= 0 ? null : `${n} prayed`;
}

const SELF_HARM = /\b(suicid\w*|kill (my ?self|me)|end (my|it all|my life)|self[- ]?harm\w*|hurt(ing)? my ?self|don'?t want to (live|be here)|want to die|cut(ting)? my ?self)\b/i;

export function mentionsSelfHarm(text: string): boolean {
  return SELF_HARM.test(text);
}

export interface Helpline {
  readonly name: string;
  readonly call: string | null;
  readonly url: string;
}

/** The phone's region's line where Yada can name it with certainty; Find A Helpline for every country otherwise. */
export function helplineFor(region: string | null): Helpline {
  const r = (region ?? "").toUpperCase();
  if (r === "GB" || r === "IE") return { name: "Samaritans", call: "116 123", url: "https://www.samaritans.org" };
  if (r === "US") return { name: "988 Suicide & Crisis Lifeline", call: "988", url: "https://988lifeline.org" };
  return { name: "Find A Helpline", call: null, url: r === "" ? "https://findahelpline.com" : `https://findahelpline.com/${r.toLowerCase()}` };
}

/** Requests to offer: none prayed for already, none from blocked askers (XT-03). */
export function offerable<T extends { readonly id: string; readonly creator: string }>(list: readonly T[], prayed: ReadonlySet<string>, blocked: ReadonlySet<string>): T[] {
  return list.filter((r) => !prayed.has(r.id) && !blocked.has(r.creator));
}

/** A circle stays people you know: 12 at most, creator included (build 8 plan §I.5). */
export const CIRCLE_MAX = 12;

/** "5 people" on Pray (CI-01); a new circle is just you. */
export function peopleLine(n: number): string {
  return n === 1 ? "Just you" : `${n} people`;
}

/** "5 of 12" beside Invite (CI-02), or null once full, when Invite is hidden. */
export function inviteLine(n: number): string | null {
  return n >= CIRCLE_MAX ? null : `${n} of ${CIRCLE_MAX}`;
}

/** "Anna · 2 days ago" under a request being prayed for (PR-09); no name, just the age; neither, nothing. */
export function askedLine(firstName: string, createdAt: number | undefined, now: number): string | null {
  const days = createdAt === undefined ? null : Math.max(0, Math.floor((now - createdAt) / 86_400_000));
  const age = days === null ? null : days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  return [firstName.trim() === "" ? null : firstName.trim(), age].filter((x) => x !== null).join(" · ") || null;
}

/** "3 people prayed · 5 days left" or "Answered 12 Oct · 7 people prayed" (PR-11): under Live and Answered, so no "Live". */
export function mineLine(r: { readonly expiresAt: number; readonly answeredAt?: number; readonly prayed?: number }, now: number): string {
  const n = r.prayed ?? 0;
  const people = n <= 0 ? null : `${n} ${n === 1 ? "person" : "people"} prayed`;
  if (r.answeredAt !== undefined) return [requestLine(r, now), people].filter((x) => x !== null).join(" · ");
  const left = daysLeft(r.expiresAt, now);
  return [people, left === 0 ? "Ended" : `${left} ${left === 1 ? "day" : "days"} left`].filter((x) => x !== null).join(" · ");
}

/** "the UK", "Nigeria": where More helplines points (PR-12), from the phone's region. */
export function regionName(region: string | null): string | null {
  if (region === null || region === "") return null;
  if (region.toUpperCase() === "GB") return "the UK";
  if (region.toUpperCase() === "US") return "the US";
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(region.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

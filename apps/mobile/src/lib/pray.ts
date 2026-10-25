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

/**
 * How long a circle waits on iCloud before saying it didn't answer. On the QA simulator a stuck iCloud left Pray's
 * circles empty and New circle on "Making it…" for good (24 Oct 2026).
 */
export const ICLOUD_WAIT_MS = 15_000;

/** `work`, or a rejection once `ms` pass. The work itself carries on; only the wait for it ends. */
export function withinTime<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("iCloud didn’t answer")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Delete circle's confirm (PC-06): "all 1 people" read oddly with only the creator in it (QA, 24 Oct 2026). */
export function deleteCircleLine(joined: number): string {
  return `${joined > 1 ? `It ends for all ${joined} people, with` : "It ends with"} every request in it. This can’t be undone.`;
}

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

/**
 * The phone's region from its locale ("en-GB" gives GB, "zh-Hant-TW" gives TW), with no extra module; null when the
 * locale has none. The script subtag ("Hant", "Latn") is not a region and once built findahelpline.com/hant (code
 * review, 23 Oct 2026).
 */
export function regionOf(locale: string): string | null {
  return locale.split("-").find((t, i) => i > 0 && /^[A-Z]{2}$/.test(t)) ?? null;
}

export function phoneRegion(): string | null {
  return regionOf(Intl.DateTimeFormat().resolvedOptions().locale);
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

/** Your requests on Pray (PR-51): newest first, answered or not; one with no date (asked before build 10) goes last. */
export function newestFirst<T extends { readonly createdAt?: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
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

/**
 * A stable index from an id (FNV-1a), so a person keeps one avatar hue and a circle one tone on every screen and every
 * phone (docs/colour-rules.md: "a person's hue comes from their id and never changes").
 */
export function hashIndex(id: string, n: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % n;
}

/** The letter on an avatar: the first letter of the name iCloud shares, or null when it shares none (no invented letter). */
export function initialOf(name: string): string | null {
  const first = name.trim().charAt(0);
  return first === "" ? null : first.toLocaleUpperCase();
}

/** "4 requests waiting" on Pray's card (PC-01); there is no line for none, which has its own card (PC-12, PC-13; XT-04). */
export function waitingLine(n: number): string | null {
  return n <= 0 ? null : `${n} ${n === 1 ? "request" : "requests"} waiting`;
}

/** "Yours: 2 people prayed · 5 days left" when only your own request is out (PC-13); "No one has prayed yet" never shows. */
export function yoursLine(r: { readonly expiresAt: number; readonly prayed?: number }, now: number): string {
  const left = daysLeft(r.expiresAt, now);
  const n = r.prayed ?? 0;
  return [n <= 0 ? null : `Yours: ${n} ${n === 1 ? "person" : "people"} prayed`, left === 0 ? "Ended" : `${left} ${left === 1 ? "day" : "days"} left`].filter((x) => x !== null).join(" · ");
}

/** A circle's picture (PC-30): the one chosen at New circle, or for an older circle one fixed by its id. */
export function circlePicture(c: { readonly id: string; readonly picture?: number }): number {
  return c.picture !== undefined && c.picture >= 1 && c.picture <= 30 ? c.picture : hashIndex(c.id, 30) + 1;
}

/** A circle's route params: the circle page and the welcome open with these. */
export function circleParams(c: { readonly id: string; readonly owner: string; readonly name: string; readonly owned: boolean; readonly people: number; readonly picture?: number }): Record<string, string> {
  return { id: c.id, owner: c.owner, name: c.name, owned: c.owned ? "1" : "", people: String(c.people), picture: String(circlePicture(c)) };
}

/** PA-03: the two prayer notifications, both on until turned off. Kept per device, as the reading reminder is. */
export interface PrayNotify {
  readonly answered: boolean;
  readonly again: boolean;
  /** FL-06: a circle you're in has a new request. */
  readonly circles: boolean;
}

export function parsePrayNotify(raw: string | undefined): PrayNotify {
  try {
    const v = JSON.parse(raw ?? "{}") as Partial<PrayNotify>;
    return { answered: v.answered !== false, again: v.again !== false, circles: v.circles !== false };
  } catch {
    return { answered: true, again: true, circles: true };
  }
}

/** PA-01: tomorrow, at the reading reminder's time, so a day has one time for Yada. */
export function prayAgainAt(now: Date, at: { readonly hour: number; readonly minute: number }): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, at.hour, at.minute, 0, 0);
}

export function prayAgainLine(at: Date): string {
  return `Tomorrow at ${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}, a reminder to pray for this again.`;
}

/** PC-23: an answered request you prayed for shows on Pray for a week after it was marked answered. */
export const ANSWERED_DAYS = 7;

export function recentlyAnswered<T extends { readonly answeredAt?: number }>(list: readonly T[], now: number): T[] {
  return list
    .filter((r) => r.answeredAt !== undefined && now - r.answeredAt <= ANSWERED_DAYS * 86_400_000)
    .sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0));
}

/** "Anna’s request was answered" over "You prayed for it · 2 days ago"; no first name, "A request you prayed for…". */
export function answeredLines(r: { readonly firstName: string; readonly answeredAt?: number }, now: number): { title: string; line: string } {
  const days = Math.floor((now - (r.answeredAt ?? now)) / 86_400_000);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return r.firstName === ""
    ? { title: "A request you prayed for was answered", line: `Answered ${when}` }
    : { title: `${r.firstName}’s request was answered`, line: `You prayed for it · ${when}` };
}

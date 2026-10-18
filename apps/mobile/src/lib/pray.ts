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

/** "Live · 7 days left", "Answered 12 Oct", "Ended": the line under a request of your own (PR-11). */
export function requestLine(r: { readonly expiresAt: number; readonly answeredAt?: number }, now: number): string {
  if (r.answeredAt !== undefined) {
    const d = new Date(r.answeredAt);
    return `Answered ${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`;
  }
  const left = daysLeft(r.expiresAt, now);
  return left === 0 ? "Ended" : `Live · ${left} ${left === 1 ? "day" : "days"} left`;
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

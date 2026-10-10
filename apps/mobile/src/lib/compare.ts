/**
 * Which versions Compare shows (decided by John 10 Oct, plan "Compare cap"):
 * the reader's translation plus up to three others. By default the first three
 * other installed versions in On your iPhone order (BSB, WEB, KJV, LSV, then
 * downloads); the reader can choose them instead, and that choice is saved.
 */

export const COMPARE_MAX = 3;

/**
 * The others to compare with, in On your iPhone order. A saved choice is kept
 * as far as it is still installed and is not the reader's own translation; an
 * empty or missing choice means the default.
 */
export function compareSelection(current: string, installed: readonly string[], chosen: readonly string[] | null): string[] {
  const others = installed.filter((code) => code !== current);
  const picked = chosen === null ? [] : others.filter((code) => chosen.includes(code));
  return (picked.length > 0 ? picked : others).slice(0, COMPARE_MAX);
}

/** Tapping a version in Choose: off if on; on if there is room, otherwise unchanged. */
export function toggleCompare(chosen: readonly string[], code: string): string[] {
  if (chosen.includes(code)) return chosen.filter((c) => c !== code);
  return chosen.length >= COMPARE_MAX ? [...chosen] : [...chosen, code];
}

/** Stored in user.db settings as "WEB,KJV,LSV". */
export function parseCompareChoice(stored: string | undefined): string[] | null {
  if (stored === undefined || stored.trim() === "") return null;
  const codes = stored.split(",").map((c) => c.trim()).filter((c) => /^[A-Z0-9]{2,8}$/.test(c));
  return codes.length === 0 ? null : [...new Set(codes)].slice(0, COMPARE_MAX);
}

/** "WEB", "WEB and KJV", "WEB, KJV and LSV". */
export function listAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1] ?? ""}`;
}

/** VoiceOver, on the Choose control: "Comparing with WEB, KJV and LSV". */
export function comparingLabel(others: readonly string[]): string {
  return others.length === 0 ? "Nothing to compare with" : `Comparing with ${listAnd(others)}`;
}

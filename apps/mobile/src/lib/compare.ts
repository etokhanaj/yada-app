/**
 * Which versions Compare shows (decided by John 10 Oct, plan "Compare cap"):
 * the reader's translation plus up to three others. By default the first three
 * other installed versions in On your iPhone order (BSB, WEB, KJV, LSV, then
 * downloads); the reader can choose them instead, and that choice is saved.
 */

export const COMPARE_MAX = 3;

/**
 * The others to compare with. A saved choice is kept in the reader's own order (CP-06: "Up to 3, in your
 * order") as far as it is still installed and is not the reader's own translation; an empty or missing
 * choice means the default, the first three in On your iPhone order.
 */
export function compareSelection(current: string, installed: readonly string[], chosen: readonly string[] | null): string[] {
  const others = installed.filter((code) => code !== current);
  const picked = chosen === null ? [] : chosen.filter((code) => others.includes(code));
  return (picked.length > 0 ? picked : others).slice(0, COMPARE_MAX);
}

/**
 * Choose's list (CP-06): the chosen first, in your order, each with a drag handle; then the rest in
 * On your iPhone order, unticked.
 */
export function chooseOrder(available: readonly string[], chosen: readonly string[]): string[] {
  return [...chosen.filter((c) => available.includes(c)), ...available.filter((c) => !chosen.includes(c))];
}

/** A chosen version dragged to a new place among the chosen (CP-06); out-of-range places are clamped. */
export function moveCompare(chosen: readonly string[], code: string, to: number): string[] {
  const from = chosen.indexOf(code);
  if (from < 0) return [...chosen];
  const rest = chosen.filter((c) => c !== code);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), code, ...rest.slice(at)];
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

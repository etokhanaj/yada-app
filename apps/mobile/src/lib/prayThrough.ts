/**
 * Pray for others (PF-30 to PF-32): a turn is one person to pray for, and the end groups who you prayed for by where
 * they asked. Pure, so it is tested.
 */

export interface Turn {
  readonly key: string;
  /** Where it was asked: "Your list", the circle's name, "Someone on Yada". */
  readonly place: string;
  readonly text: string;
  readonly kind: "list" | "circle" | "public";
  readonly id?: string;
  /** In a circle: who asked, for their avatar and first name (empty when iCloud shares none). */
  readonly asker?: { readonly id: string; readonly name: string };
  readonly circle?: { readonly id: string; readonly owner: string };
  /** "Today", "2 days ago": only where the request has a date (a public one). */
  readonly asked?: string | null;
}

/** PF-32's rows: each place once, in the order first prayed, with "2 prayers" for your list and "1 request" elsewhere. */
export function prayedByPlace(prayed: readonly Turn[]): Array<{ place: string; kind: Turn["kind"]; line: string }> {
  const out = new Map<string, { kind: Turn["kind"]; n: number }>();
  for (const t of prayed) {
    const at = out.get(t.place);
    out.set(t.place, { kind: t.kind, n: (at?.n ?? 0) + 1 });
  }
  return [...out].map(([place, { kind, n }]) => {
    const noun = kind === "list" ? "prayer" : "request";
    return { place, kind, line: `${n} ${noun}${n === 1 ? "" : "s"}` };
  });
}

/**
 * MM-02, same first words: a verse whose BSB opens with the words Genesis 1:1 opens with ("In the
 * beginning": John 1:1) is set over Genesis 1:1, each with the original words that carry the phrase. A
 * data fact in a fixed sentence, never an interpretation (IA-13 "No AI").
 */

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w !== "");

/** The opening both share, in the first text's own casing, when it is at least three words. */
export function sharedOpening(text: string, other: string, min = 3): string | null {
  const a = words(text);
  const b = words(other);
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  if (n < min) return null;
  return text.split(/\s+/).slice(0, n).join(" ").replace(/[,;:.]$/, "");
}

/** The leading original words whose English all falls inside the shared phrase ("Ἐν ἀρχῇ", "בְּרֵאשִׁית"). */
export function leadingInPhrase<T extends { gloss: string | null }>(tokens: readonly T[], phrase: string): T[] {
  const inPhrase = new Set(words(phrase));
  const out: T[] = [];
  for (const t of tokens) {
    const g = words(t.gloss ?? "");
    if (g.length === 0 || !g.every((w) => inPhrase.has(w))) break;
    out.push(t);
  }
  return out;
}

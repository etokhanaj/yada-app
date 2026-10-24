/**
 * The filter a request passes before it is posted to Pray or to a circle (App Store guideline 1.2: "a method for
 * filtering objectionable material from being posted"). Pure, so it is tested; no package, so nothing leaves the phone.
 *
 * What it blocks: strong profanity, slurs, abuse aimed at someone ("kill yourself") and explicit sexual vulgarity, plus
 * links, which a prayer request never needs and spam always does. What it leaves alone, on purpose: words people use
 * to ask for prayer about hard things ("porn", "rape", "abuse", "suicide", "hell", "whore" in the KJV sense). Blocking
 * those would silence the readers who most need prayer; Report, Block and the review queue handle misuse of them.
 * Self-harm is not this module's business: Ask shows a helpline for it first (lib/pray.ts, PR-12).
 *
 * Matching is whole-word and case-insensitive on text that has been normalised the same way as the list: accents
 * dropped, simple leetspeak read as letters (f4gg0t) and dots or stars inside a word removed (f.u.c.k). Each letter of a
 * listed word may repeat (fuuuck), rather than squeezing the text: squeezed, "nigger" became "niger" and blocked the
 * country. Whole words keep "Scunthorpe", "assess" and "Dickens" postable.
 */

export type Refusal = "words" | "link";

/** A trailing `*` lets the word take any ending (fucking, cunts). Lower case and unaccented, as `normalise` leaves text. */
const WORDS = [
  // Strong profanity.
  "fuck*", "motherfuck*", "fck", "fuk", "fking", "cunt*", "wanker*", "twat*", "bollocks",
  // Slurs: race, religion, sexuality, disability.
  "nigger*", "nigga*", "chink*", "gook*", "spic", "spics", "wetback*", "kike*", "raghead*", "towelhead*", "paki", "pakis",
  "coon", "coons", "jigaboo*", "faggot*", "fag", "fags", "dyke*", "tranny", "trannies", "retard", "retards", "retarded",
  // Explicit sexual vulgarity.
  "cocksuck*", "blowjob*", "handjob*", "dickhead*", "dick pic*", "pussy", "pussies", "slut*", "nudes", "jizz",
  // Abuse aimed at someone.
  "kill yourself", "kill urself", "kys", "go die", "hope you die", "hope u die", "neck yourself",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

/** Lower case, no accents, leet read as letters. */
export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Only beside a letter, and "!" only before one: "kys!" stays "kys", and "1 Kings" stays as it is.
    .replace(/[013457@$](?=[a-z])|(?<=[a-z])[013457@$]|!(?=[a-z])/g, (c) => LEET[c] ?? c);
}

/** "fuck" as /f+u+c+k+/: any letter may be held down; a space may be any run of spaces. */
const word = (w: string) => [...w].map((c) => (c === " " ? "\\s+" : `${c}+`)).join("");
const pattern = new RegExp(`\\b(?:${WORDS.map((w) => (w.endsWith("*") ? `${word(w.slice(0, -1))}[a-z]*` : word(w))).join("|")})\\b`);
// Read before normalising: "www.x.com" would lose its dots.
const LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|io|xyz|info|biz|ru|tk)(?:\/|\b)/i;

/** Why a request cannot be posted, or null when it can. */
export function refusal(text: string): Refusal | null {
  if (LINK.test(text)) return "link";
  const plain = normalise(text);
  // Both with and without separators inside words: "f.u.c.k" is caught joined, "fine.fuck" only as it stands.
  return pattern.test(plain) || pattern.test(plain.replace(/(?<=[a-z])[.*_-]+(?=[a-z])/g, "")) ? "words" : null;
}

/** The one line Ask shows in place of its note when a request is refused. */
export function refusalLine(r: Refusal): string {
  return r === "link" ? "Requests can’t include links. Remove it to post." : "This request has words that aren’t allowed in Pray. Change them to post.";
}

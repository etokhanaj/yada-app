/**
 * Splits English prose into runs of Greek, Hebrew and everything else, so each
 * Greek or Hebrew run can carry `accessibilityLanguage` (brief §5: "Every Greek
 * or Hebrew run sets accessibilityLanguage, including Greek inside English
 * claims"). Without it VoiceOver reads σιγάτωσαν letter by letter in an English
 * voice.
 *
 * Spaces and punctuation between two words of the same script stay inside the
 * run, so "οἱ γυναῖκες" is one phrase to VoiceOver, not two words and a gap.
 * Combining marks (accents, niqqud, cantillation) belong to their letter.
 */

export type ScriptLang = "el" | "he";

export interface ScriptRun {
  readonly text: string;
  readonly lang: ScriptLang | null;
}

type CharClass = ScriptLang | "mark" | "neutral" | "other";

function classify(ch: string): CharClass {
  const c = ch.codePointAt(0) ?? 0;
  if ((c >= 0x0370 && c <= 0x03ff) || (c >= 0x1f00 && c <= 0x1fff)) return "el";
  // Hebrew block (letters, niqqud, maqaf, sof pasuq) and presentation forms.
  if ((c >= 0x0590 && c <= 0x05ff) || (c >= 0xfb1d && c <= 0xfb4f)) return "he";
  if ((c >= 0x0300 && c <= 0x036f) || c === 0x200d || c === 0x200c) return "mark";
  if (/[\s.,;:·!?'"’‘“”()[\]—–-]/u.test(ch)) return "neutral";
  return "other";
}

export function splitScriptRuns(text: string): ScriptRun[] {
  const runs: Array<{ text: string; lang: ScriptLang | null }> = [];
  let pending = "";

  const push = (chunk: string, lang: ScriptLang | null) => {
    if (chunk === "") return;
    const last = runs[runs.length - 1];
    if (last !== undefined && last.lang === lang) last.text += chunk;
    else runs.push({ text: chunk, lang });
  };

  for (const ch of text) {
    const kind = classify(ch);
    const lastLang = runs[runs.length - 1]?.lang ?? null;
    if (kind === "mark") {
      // A mark joins whatever it follows, including neutrals waiting to be placed.
      if (pending !== "") pending += ch;
      else push(ch, lastLang);
      continue;
    }
    if (kind === "neutral") {
      pending += ch;
      continue;
    }
    const lang = kind === "other" ? null : kind;
    // Neutrals between two runs of the same script stay in it; otherwise they are English.
    push(pending, runs.length > 0 && lastLang === lang ? lang : null);
    pending = "";
    push(ch, lang);
  }
  push(pending, null);
  return runs;
}

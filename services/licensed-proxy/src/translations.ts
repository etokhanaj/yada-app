/**
 * The licensed translations the API.Bible account holds, and which of them this Worker serves.
 *
 * The served set is the SERVED var in wrangler.toml, not this list, so a translation is switched
 * on or off with a deploy and no app update. NIV is known here but not served: Biblica's express
 * licence through api.bible requires a product with no AI/ML features, and Yada's explanations are
 * AI-generated (decision of 12 Oct 2026, docs/licensed-translations.md). John removed it from the
 * account the same day and added MSG; its id stays mapped so a direct Biblica licence could switch it
 * back with a deploy.
 */

export const BIBLES = {
  NIV: "78a9f6124f344018-01",
  NKJV: "63097d2a0a2f7db3-01",
  NLT: "d6e14a625393b4da-01",
  // The Message (NavPress, represented by Tyndale House), on the account from 12 Oct 2026.
  MSG: "6f11a7de016f942e-01",
} as const;

export type LicensedCode = keyof typeof BIBLES;

export function isLicensedCode(value: string): value is LicensedCode {
  return Object.prototype.hasOwnProperty.call(BIBLES, value);
}

/**
 * "NKJV,NLT,MSG" to its known codes, in a stable order. A name the account does not hold is dropped,
 * so a typo in the var serves less, never something unexpected.
 */
export function servedSet(raw: string | undefined): LicensedCode[] {
  const named = new Set((raw ?? "").split(",").map((s) => s.trim().toUpperCase()));
  return (Object.keys(BIBLES) as LicensedCode[]).filter((code) => named.has(code));
}

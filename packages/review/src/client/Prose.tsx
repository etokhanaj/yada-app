/**
 * English prose that may contain Hebrew or Greek.
 *
 * The element pins `dir="ltr"`: the bidi algorithm takes a paragraph's
 * direction from its first strong character, so a claim opening with a Hebrew
 * word would otherwise lay out right-to-left (see LTR_PROSE in the mobile
 * tokens). Original-language runs are wrapped so they get their own face —
 * Gentium Plus for Greek, Noto Serif Hebrew for Hebrew — and each Hebrew run is
 * bidi-isolated, keeping a multi-word phrase in its own right-to-left order.
 */

import type { ReactNode } from "react";

const HEBREW = "\\u0590-\\u05FF\\uFB1D-\\uFB4F";
const GREEK = "\\u0370-\\u03FF\\u1F00-\\u1FFF";
const COMBINING = "\\u0300-\\u036F";

const SCRIPT_RUN = new RegExp(
  `([${HEBREW}]+(?:[\\s\\u05BE/]+[${HEBREW}]+)*)|([${GREEK}][${GREEK}${COMBINING}]*(?:\\s+[${GREEK}][${GREEK}${COMBINING}]*)*)`,
  "gu",
);

export function splitScripts(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(SCRIPT_RUN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    if (match[1] !== undefined) {
      out.push(
        <span key={index} lang="he" dir="rtl" className="he">
          {match[1]}
        </span>,
      );
    } else {
      out.push(
        <span key={index} lang="grc" className="grc">
          {match[0]}
        </span>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Prose({
  text,
  as: Tag = "p",
  className,
}: {
  text: string;
  as?: "p" | "div" | "span";
  className?: string;
}) {
  return (
    <Tag dir="ltr" className={className === undefined ? "ltr" : `ltr ${className}`}>
      {splitScripts(text)}
    </Tag>
  );
}

/** Attributes for a bare original-language surface form. */
export function scriptAttrs(script: "greek" | "hebrew"): {
  className: string;
  lang: string;
  dir: "ltr" | "rtl";
} {
  return script === "hebrew"
    ? { className: "he", lang: "he", dir: "rtl" }
    : { className: "grc", lang: "grc", dir: "ltr" };
}

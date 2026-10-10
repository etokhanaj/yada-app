/**
 * WCAG 2 contrast, for the palette tests. Translucent colours (fill, glass) are
 * composited over the ground they are drawn on before measuring, because that
 * is the colour the reader actually sees.
 */

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export function parseColor(color: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex !== null) {
    const n = Number.parseInt(hex[1] ?? "", 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color);
  if (rgba !== null) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: Number(rgba[4]) };
  }
  throw new Error(`Unsupported colour: ${color}`);
}

/** `#RRGGBB` at zero alpha: the end stop of a paper fade under floating chrome. */
export function transparent(hex: string): string {
  const { r, g, b } = parseColor(hex);
  return `rgba(${r},${g},${b},0)`;
}

/** `top` drawn over an opaque `ground`. */
export function over(top: string, ground: string): Rgba {
  const t = parseColor(top);
  const g = parseColor(ground);
  const mix = (a: number, b: number) => a * t.a + b * (1 - t.a);
  return { r: mix(t.r, g.r), g: mix(t.g, g.g), b: mix(t.b, g.b), a: 1 };
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: Rgba): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrast(a: string | Rgba, b: string | Rgba): number {
  const la = luminance(typeof a === "string" ? parseColor(a) : a);
  const lb = luminance(typeof b === "string" ? parseColor(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

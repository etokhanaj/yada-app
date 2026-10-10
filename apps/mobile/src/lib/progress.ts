/**
 * Download progress as the Translations sheet shows and speaks it (canvas
 * MT-03): `0.6 of 1.3 MB` beside a ring, and VoiceOver told at 25% steps only
 * (plan, accessibility 4), so a download never floods the announcer.
 */

const MB = 1_000_000;

/** "1.3 MB": one decimal, as the eBible packages and the canvas give sizes. */
export function formatMB(bytes: number): string {
  return `${(Math.max(0, bytes) / MB).toFixed(1)} MB`;
}

/** "1.3 megabytes", for VoiceOver, which reads "MB" as letters. */
export function spokenMB(bytes: number): string {
  return `${(Math.max(0, bytes) / MB).toFixed(1)} megabytes`;
}

/** "0.6 of 1.3 MB". */
export function progressLine(written: number, total: number): string {
  return `${(Math.min(Math.max(0, written), total) / MB).toFixed(1)} of ${formatMB(total)}`;
}

/** Whole percent, clamped; a server without Content-Length falls back to the manifest's size. */
export function percent(written: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((written / total) * 100)));
}

/** The last 25% step reached: 0, 25, 50, 75 or 100. */
export function quarter(pct: number): number {
  return Math.min(100, Math.max(0, Math.floor(pct / 25) * 25));
}

/**
 * What to announce when progress moves from `before` to `after` percent, or
 * null. Only a newly reached 25, 50 or 75 is spoken; the end is announced by
 * the row itself ("Downloaded"), and 0 is the tap that started it.
 */
export function progressAnnouncement(before: number, after: number, name: string): string | null {
  const step = quarter(after);
  if (step === 0 || step === 100 || step <= quarter(before)) return null;
  return `${name}, ${step} percent`;
}

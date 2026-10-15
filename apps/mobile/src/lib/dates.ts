/**
 * Dates from the reader's own data (John, 12 Oct 2026): "12 Oct" in the current year, otherwise
 * "12 Oct 2025". Never relative ("3 days ago").
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function formatDay(date: Date, now: Date = new Date()): string {
  const day = `${date.getDate()} ${MONTHS[date.getMonth()] ?? ""}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`;
}

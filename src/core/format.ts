// Locale-aware display formatting. The UI is French, so every user-visible
// date must go through here — calling date-fns `format` directly silently
// falls back to English month names.
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { parseISO, spanDays } from "./dates";
import type { ISODate } from "./types";

const OPTS = { locale: fr } as const;

/** Format an ISO date with a date-fns pattern, in the app locale. */
export function formatISO(iso: ISODate, pattern: string): string {
  return format(parseISO(iso), pattern, OPTS);
}

/** Format a Date with a date-fns pattern, in the app locale. */
export function formatDate(date: Date, pattern: string): string {
  return format(date, pattern, OPTS);
}

/** Short form used on drag tooltips and bar labels: "12 juil.". */
export function shortDate(iso: ISODate): string {
  return formatISO(iso, "d MMM");
}

/** Full range shown under a task name: "12 juil. – 18 juil. 2026". */
export function dateRangeLabel(start: ISODate, end: ISODate): string {
  if (start === end) return formatISO(start, "d MMM yyyy");
  return `${shortDate(start)} – ${formatISO(end, "d MMM yyyy")}`;
}

/** Inclusive duration with unit, e.g. "7 j". */
export function durationLabel(start: ISODate, end: ISODate): string {
  return `${spanDays(start, end)} j`;
}

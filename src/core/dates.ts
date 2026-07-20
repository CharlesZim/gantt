// Date helpers built on date-fns. Pure — safe for the portable core.
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO as dfParseISO,
} from "date-fns";
import type { ISODate } from "./types";

/** Parse an ISO date string ("2026-07-20") to a Date at local midnight. */
export function parseISO(iso: ISODate): Date {
  return dfParseISO(iso);
}

/** Format a Date as an ISO calendar date ("2026-07-20"). */
export function toISO(date: Date): ISODate {
  return format(date, "yyyy-MM-dd");
}

/** Today's calendar date as an ISO string. */
export function todayISO(): ISODate {
  return toISO(new Date());
}

/** Whether a string is a valid ISO calendar date. */
export function isValidISO(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && isValid(dfParseISO(iso));
}

/** Add `n` days to an ISO date (n may be negative). */
export function addDaysISO(iso: ISODate, n: number): ISODate {
  return toISO(addDays(parseISO(iso), n));
}

/**
 * Signed calendar-day distance from `a` to `b` (b - a).
 * daysBetween(x, x) === 0. Independent of clock time / DST.
 */
export function daysBetween(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

/** Inclusive number of days a task occupies: 1 for a single-day task. */
export function spanDays(start: ISODate, end: ISODate): number {
  return daysBetween(start, end) + 1;
}

/** Clamp an ISO date into [min, max] (either bound optional). */
export function clampISO(iso: ISODate, min?: ISODate, max?: ISODate): ISODate {
  if (min && daysBetween(min, iso) < 0) return min;
  if (max && daysBetween(iso, max) < 0) return max;
  return iso;
}

/** Earliest of a non-empty list of ISO dates. */
export function minISO(dates: ISODate[]): ISODate {
  // daysBetween(a, b) = b - a; a is earlier (or equal) when that is >= 0.
  return dates.reduce((a, b) => (daysBetween(a, b) >= 0 ? a : b));
}

/** Latest of a non-empty list of ISO dates. */
export function maxISO(dates: ISODate[]): ISODate {
  // a is later (or equal) when b - a <= 0.
  return dates.reduce((a, b) => (daysBetween(a, b) <= 0 ? a : b));
}

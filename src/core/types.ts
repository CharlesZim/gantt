// Pure domain types. No React, no DOM, no browser APIs.
// This module is the portable core intended for reuse in a future iOS app.

/** ISO calendar date, e.g. "2026-07-20" (no time component). */
export type ISODate = string;

export interface Task {
  id: string;
  name: string;
  start: ISODate;
  /** Inclusive end date; always >= start (minimum span is 1 day). */
  end: ISODate;
  /** Index into the active theme's bar palette. */
  colorKey: number;
  /** Vertical display order (0-based). */
  order: number;
}

export type TimeUnit = "day" | "week" | "month";

export interface GanttState {
  title: string;
  tasks: Task[];
  themeId: string;
  /** Zoom granularity. */
  unit: TimeUnit;
}

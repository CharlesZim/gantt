// Pure layout engine: tasks + dates -> geometry for bars, axis and decorations.
// No React, no DOM. Fully unit-testable.
import {
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  addDaysISO,
  daysBetween,
  maxISO,
  minISO,
  parseISO,
  spanDays,
  toISO,
  todayISO,
} from "./dates";
import type { ISODate, Task, TimeUnit } from "./types";

export interface LayoutInput {
  tasks: Task[];
  unit: TimeUnit;
  rowHeight: number; // e.g. 44
  barHeight: number; // e.g. 26
  pxPerDay: number; // derived from unit (day≈40, week≈14, month≈5)
  padDays: number; // leading/trailing margin in days (e.g. 2)
  /** Optional override for "today"; defaults to the real current date. */
  today?: ISODate;
}

export interface BarLayout {
  taskId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bottom-level graduation (days / weeks / months depending on unit). */
export interface AxisTick {
  x: number;
  label: string;
  major: boolean;
  date: ISODate;
}

/** Top-level band (months, or years in month view) rendered above the ticks. */
export interface AxisSegment {
  x: number;
  width: number;
  label: string;
  date: ISODate;
}

export interface LayoutResult {
  bars: BarLayout[];
  ticks: AxisTick[];
  axisTop: AxisSegment[];
  totalWidth: number;
  totalHeight: number;
  rangeStart: ISODate;
  rangeEnd: ISODate;
  todayX: number | null;
  weekendBands: { x: number; width: number }[];
}

/** Recommended pixels-per-day for each zoom unit. */
export const PX_PER_DAY: Record<TimeUnit, number> = {
  day: 40,
  week: 14,
  month: 5,
};

export function pxPerDayForUnit(unit: TimeUnit): number {
  return PX_PER_DAY[unit];
}

function isWeekend(date: Date): boolean {
  const d = getDay(date); // 0 = Sunday, 6 = Saturday
  return d === 0 || d === 6;
}

/** Compute the visible date window from the tasks (or a default when empty). */
function computeRange(
  tasks: Task[],
  padDays: number,
  today: ISODate,
): { rangeStart: ISODate; rangeEnd: ISODate } {
  if (tasks.length === 0) {
    const now = parseISO(today);
    return {
      rangeStart: toISO(startOfMonth(now)),
      rangeEnd: toISO(endOfMonth(now)),
    };
  }
  const starts = tasks.map((t) => t.start);
  const ends = tasks.map((t) => t.end);
  return {
    rangeStart: addDaysISO(minISO(starts), -padDays),
    rangeEnd: addDaysISO(maxISO(ends), padDays),
  };
}

/** Build the bottom-level ticks for the given unit. */
function buildTicks(
  rangeStart: ISODate,
  rangeEnd: ISODate,
  unit: TimeUnit,
  pxPerDay: number,
): AxisTick[] {
  const ticks: AxisTick[] = [];
  const startDate = parseISO(rangeStart);
  const endDate = parseISO(rangeEnd);
  const xOf = (iso: ISODate) => daysBetween(rangeStart, iso) * pxPerDay;

  if (unit === "day") {
    for (let i = 0; i <= daysBetween(rangeStart, rangeEnd); i++) {
      const iso = addDaysISO(rangeStart, i);
      const date = parseISO(iso);
      ticks.push({
        x: i * pxPerDay,
        label: format(date, "d"),
        major: getDay(date) === 1, // Monday
        date: iso,
      });
    }
    return ticks;
  }

  if (unit === "week") {
    // First Monday on or before the range start.
    let cursor = startOfWeek(startDate, { weekStartsOn: 1 });
    while (cursor <= endDate) {
      const iso = toISO(cursor);
      // Major when a month boundary falls within this week.
      const weekEnd = parseISO(addDaysISO(iso, 6));
      const major = cursor.getMonth() !== weekEnd.getMonth();
      if (daysBetween(rangeStart, iso) >= 0) {
        ticks.push({ x: xOf(iso), label: format(cursor, "d MMM"), major, date: iso });
      }
      cursor = addWeeks(cursor, 1);
    }
    return ticks;
  }

  // month
  let cursor = startOfMonth(startDate);
  while (cursor <= endDate) {
    const iso = toISO(cursor);
    if (daysBetween(rangeStart, iso) >= 0) {
      ticks.push({
        x: xOf(iso),
        label: format(cursor, "MMM"),
        major: cursor.getMonth() === 0, // January
        date: iso,
      });
    }
    cursor = addMonths(cursor, 1);
  }
  return ticks;
}

/** Build the top-level segments (months, or years in month view). */
function buildAxisTop(
  rangeStart: ISODate,
  rangeEnd: ISODate,
  unit: TimeUnit,
  pxPerDay: number,
): AxisSegment[] {
  const segments: AxisSegment[] = [];
  const startDate = parseISO(rangeStart);
  const endDate = parseISO(rangeEnd);

  const byYear = unit === "month";
  const step = (d: Date) => (byYear ? addYears(d, 1) : addMonths(d, 1));
  const periodStart = (d: Date) => (byYear ? startOfYear(d) : startOfMonth(d));
  const labelFmt = byYear ? "yyyy" : "MMMM yyyy";

  let cursor = periodStart(startDate);
  while (cursor <= endDate) {
    const next = step(cursor);
    // Clip the period to the visible window.
    const segStartISO = maxISO([toISO(cursor), rangeStart]);
    const segEndISO = minISO([toISO(addDaysISO(toISO(next), -1)), rangeEnd]);
    const x = daysBetween(rangeStart, segStartISO) * pxPerDay;
    const width = spanDays(segStartISO, segEndISO) * pxPerDay;
    // Guard against zero-width periods outside the window.
    if (width > 0 && daysBetween(segStartISO, segEndISO) >= 0) {
      segments.push({ x, width, label: format(cursor, labelFmt), date: segStartISO });
    }
    cursor = next;
  }
  return segments;
}

export function computeLayout(input: LayoutInput): LayoutResult {
  const { tasks, unit, rowHeight, barHeight, pxPerDay, padDays } = input;
  const today = input.today ?? todayISO();

  const { rangeStart, rangeEnd } = computeRange(tasks, padDays, today);

  const bars: BarLayout[] = tasks.map((task) => {
    const x = daysBetween(rangeStart, task.start) * pxPerDay;
    const width = spanDays(task.start, task.end) * pxPerDay;
    const y = task.order * rowHeight + (rowHeight - barHeight) / 2;
    return { taskId: task.id, x, y, width, height: barHeight };
  });

  const ticks = buildTicks(rangeStart, rangeEnd, unit, pxPerDay);
  const axisTop = buildAxisTop(rangeStart, rangeEnd, unit, pxPerDay);

  const totalWidth = spanDays(rangeStart, rangeEnd) * pxPerDay;
  const totalHeight = tasks.length * rowHeight;

  // Today marker (left edge of today's column), null when outside the window.
  let todayX: number | null = null;
  if (daysBetween(rangeStart, today) >= 0 && daysBetween(today, rangeEnd) >= 0) {
    todayX = daysBetween(rangeStart, today) * pxPerDay;
  }

  // Weekend bands only make sense in day view.
  const weekendBands: { x: number; width: number }[] = [];
  if (unit === "day") {
    for (let i = 0; i <= daysBetween(rangeStart, rangeEnd); i++) {
      const date = parseISO(addDaysISO(rangeStart, i));
      if (isWeekend(date)) {
        weekendBands.push({ x: i * pxPerDay, width: pxPerDay });
      }
    }
  }

  return {
    bars,
    ticks,
    axisTop,
    totalWidth,
    totalHeight,
    rangeStart,
    rangeEnd,
    todayX,
    weekendBands,
  };
}

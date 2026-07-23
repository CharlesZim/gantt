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
import { fr } from "date-fns/locale";
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
import { isMilestone, taskProgress, type ISODate, type Task, type TimeUnit } from "./types";

/** Axis labels are user-facing, so they follow the app locale. */
const LOCALE = { locale: fr } as const;

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
  /** True when the task renders as a diamond marker instead of a bar. */
  milestone: boolean;
  /** Width of the completed portion, in px. 0 when no progress is set. */
  progressWidth: number;
  /** Center of the row, for milestone markers and dependency routing. */
  cy: number;
}

/** An elbow-routed finish-to-start dependency arrow. */
export interface LinkLayout {
  fromId: string;
  toId: string;
  /** Polyline vertices, already in chart coordinates. */
  points: { x: number; y: number }[];
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
  links: LinkLayout[];
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

/**
 * Elbow route for a finish-to-start link, from the right edge of `from` to the
 * left edge of `to`. When the successor starts before the predecessor ends the
 * route detours vertically between the two rows rather than crossing the bars.
 */
function routeLink(from: BarLayout, to: BarLayout, rowHeight: number): { x: number; y: number }[] {
  const STUB = 10; // horizontal stub off each bar edge
  const x1 = from.x + from.width;
  const y1 = from.cy;
  const x2 = to.x;
  const y2 = to.cy;

  if (x2 - x1 >= STUB * 2) {
    // Enough room: out, across, in.
    const midX = x2 - STUB;
    return [
      { x: x1, y: y1 },
      { x: midX, y: y1 },
      { x: midX, y: y2 },
      { x: x2, y: y2 },
    ];
  }

  // Backwards or tight: drop into the gutter between the two rows and come back.
  const goingDown = y2 > y1;
  const gutterY = goingDown
    ? y1 + rowHeight / 2
    : y1 - rowHeight / 2;
  return [
    { x: x1, y: y1 },
    { x: x1 + STUB, y: y1 },
    { x: x1 + STUB, y: gutterY },
    { x: x2 - STUB, y: gutterY },
    { x: x2 - STUB, y: y2 },
    { x: x2, y: y2 },
  ];
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
        label: format(date, "d", LOCALE),
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
        ticks.push({ x: xOf(iso), label: format(cursor, "d MMM", LOCALE), major, date: iso });
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
        label: format(cursor, "MMM", LOCALE),
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
    const segEndISO = minISO([addDaysISO(toISO(next), -1), rangeEnd]);
    const x = daysBetween(rangeStart, segStartISO) * pxPerDay;
    const width = spanDays(segStartISO, segEndISO) * pxPerDay;
    // Guard against zero-width periods outside the window.
    if (width > 0 && daysBetween(segStartISO, segEndISO) >= 0) {
      segments.push({ x, width, label: format(cursor, labelFmt, LOCALE), date: segStartISO });
    }
    cursor = next;
  }
  return segments;
}

export function computeLayout(input: LayoutInput): LayoutResult {
  const { tasks, unit, rowHeight, barHeight, pxPerDay, padDays } = input;
  const today = input.today ?? todayISO();

  const { rangeStart, rangeEnd } = computeRange(tasks, padDays, today);

  // Bars are laid out in the caller's order, not by `task.order`, so a list
  // that has been filtered or re-sorted still stacks without gaps.
  const bars: BarLayout[] = tasks.map((task, row) => {
    const milestone = isMilestone(task);
    const x = daysBetween(rangeStart, task.start) * pxPerDay;
    const width = milestone ? pxPerDay : spanDays(task.start, task.end) * pxPerDay;
    const y = row * rowHeight + (rowHeight - barHeight) / 2;
    return {
      taskId: task.id,
      x,
      y,
      width,
      height: barHeight,
      milestone,
      progressWidth: milestone ? 0 : width * taskProgress(task),
      cy: row * rowHeight + rowHeight / 2,
    };
  });

  // Dependency arrows. Links pointing at an unknown / self id are dropped.
  const barById = new Map(bars.map((b) => [b.taskId, b]));
  const links: LinkLayout[] = [];
  for (const task of tasks) {
    for (const depId of task.deps ?? []) {
      if (depId === task.id) continue;
      const from = barById.get(depId);
      const to = barById.get(task.id);
      if (!from || !to) continue;
      links.push({ fromId: depId, toId: task.id, points: routeLink(from, to, rowHeight) });
    }
  }

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
    links,
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

// Pure domain types. No React, no DOM, no browser APIs.
// This module is the portable core intended for reuse in a future iOS app.

/** ISO calendar date, e.g. "2026-07-20" (no time component). */
export type ISODate = string;

/** A bar spans a date range; a milestone is a single dated marker. */
export type TaskKind = "task" | "milestone";

export interface Task {
  id: string;
  name: string;
  start: ISODate;
  /**
   * Inclusive end date; always >= start (minimum span is 1 day).
   * For a milestone this always equals `start`.
   */
  end: ISODate;
  /** Index into the active theme's bar palette (used when `color` is unset). */
  colorKey: number;
  /** Optional explicit bar color (hex). Overrides the theme palette when set. */
  color?: string;
  /** Vertical display order (0-based). */
  order: number;
  /** Bar or milestone. Absent means "task" (state written before milestones). */
  kind?: TaskKind;
  /** Completion ratio in [0, 1]. Undefined or 0 means "not started". */
  progress?: number;
  /**
   * Ids of tasks this one depends on (finish-to-start).
   * Cycles are rejected at the mutation layer, so this stays a DAG.
   */
  deps?: string[];
}

export type TimeUnit = "day" | "week" | "month";

export interface GanttState {
  title: string;
  tasks: Task[];
  themeId: string;
  /** Zoom granularity. */
  unit: TimeUnit;
}

/** Whether a task renders as a milestone marker rather than a bar. */
export function isMilestone(task: Pick<Task, "kind">): boolean {
  return task.kind === "milestone";
}

/** Progress clamped into [0, 1]; 0 when unset. */
export function taskProgress(task: Pick<Task, "progress">): number {
  const p = task.progress;
  if (typeof p !== "number" || Number.isNaN(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

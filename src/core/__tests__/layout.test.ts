import { describe, expect, it } from "vitest";
import { computeLayout, pxPerDayForUnit, type LayoutInput } from "../layout";
import type { Task } from "../types";

function task(partial: Partial<Task> & Pick<Task, "id" | "start" | "end" | "order">): Task {
  return {
    name: "Task",
    colorKey: 0,
    ...partial,
  };
}

const base: Omit<LayoutInput, "tasks"> = {
  unit: "day",
  rowHeight: 44,
  barHeight: 26,
  pxPerDay: 40,
  padDays: 2,
  today: "2026-07-20",
};

describe("computeLayout - bars", () => {
  it("positions a single-day bar with inclusive width", () => {
    const tasks = [task({ id: "a", start: "2026-07-10", end: "2026-07-10", order: 0 })];
    const r = computeLayout({ ...base, tasks });

    // rangeStart = start - padDays = 2026-07-08
    expect(r.rangeStart).toBe("2026-07-08");
    expect(r.rangeEnd).toBe("2026-07-12"); // end + padDays

    const bar = r.bars[0];
    expect(bar.x).toBe(2 * 40); // 2 days from rangeStart
    expect(bar.width).toBe(1 * 40); // inclusive single day
    expect(bar.height).toBe(26);
    expect(bar.y).toBe(0 * 44 + (44 - 26) / 2);
  });

  it("computes multi-day inclusive width", () => {
    const tasks = [task({ id: "a", start: "2026-07-10", end: "2026-07-14", order: 0 })];
    const r = computeLayout({ ...base, tasks });
    expect(r.bars[0].width).toBe(5 * 40); // 5 inclusive days
  });

  it("stacks rows by list position, leaving no gap for sparse orders", () => {
    // `order` may be sparse (a filtered view, a mid-drag list). Rows follow the
    // array so bars always stay inside totalHeight.
    const tasks = [
      task({ id: "a", start: "2026-07-10", end: "2026-07-10", order: 0 }),
      task({ id: "b", start: "2026-07-10", end: "2026-07-10", order: 2 }),
    ];
    const r = computeLayout({ ...base, tasks });
    expect(r.bars[1].y).toBe(1 * 44 + (44 - 26) / 2);
    expect(r.bars[1].y + r.bars[1].height).toBeLessThanOrEqual(r.totalHeight);
    expect(r.totalHeight).toBe(2 * 44);
  });

  it("spans the whole range across tasks", () => {
    const tasks = [
      task({ id: "a", start: "2026-07-01", end: "2026-07-05", order: 0 }),
      task({ id: "b", start: "2026-07-10", end: "2026-07-20", order: 1 }),
    ];
    const r = computeLayout({ ...base, tasks });
    expect(r.rangeStart).toBe("2026-06-29");
    expect(r.rangeEnd).toBe("2026-07-22");
    // totalWidth = inclusive days * pxPerDay
    expect(r.totalWidth).toBe((24) * 40); // 2026-06-29..2026-07-22 = 24 days inclusive
  });
});

describe("computeLayout - empty state", () => {
  it("defaults to the current month when there are no tasks", () => {
    const r = computeLayout({ ...base, tasks: [] });
    expect(r.rangeStart).toBe("2026-07-01");
    expect(r.rangeEnd).toBe("2026-07-31");
    expect(r.bars).toHaveLength(0);
    expect(r.totalHeight).toBe(0);
  });
});

describe("computeLayout - today marker", () => {
  it("places the marker inside the window", () => {
    const tasks = [task({ id: "a", start: "2026-07-18", end: "2026-07-22", order: 0 })];
    const r = computeLayout({ ...base, tasks });
    // rangeStart = 2026-07-16, today = 2026-07-20 -> 4 days in
    expect(r.todayX).toBe(4 * 40);
  });

  it("is null when today is outside the window", () => {
    const tasks = [task({ id: "a", start: "2026-01-10", end: "2026-01-12", order: 0 })];
    const r = computeLayout({ ...base, tasks });
    expect(r.todayX).toBeNull();
  });
});

describe("computeLayout - weekend bands", () => {
  it("adds bands for saturdays and sundays in day view", () => {
    // 2026-07-18 is a Saturday, 2026-07-19 a Sunday.
    const tasks = [task({ id: "a", start: "2026-07-17", end: "2026-07-20", order: 0 })];
    const r = computeLayout({ ...base, tasks });
    expect(r.weekendBands.length).toBeGreaterThanOrEqual(2);
  });

  it("emits no weekend bands outside day view", () => {
    const tasks = [task({ id: "a", start: "2026-07-01", end: "2026-08-30", order: 0 })];
    const r = computeLayout({ ...base, tasks, unit: "week", pxPerDay: pxPerDayForUnit("week") });
    expect(r.weekendBands).toHaveLength(0);
  });
});

describe("computeLayout - axis", () => {
  it("emits one tick per day in day view with Monday majors", () => {
    const tasks = [task({ id: "a", start: "2026-07-06", end: "2026-07-12", order: 0 })];
    const r = computeLayout({ ...base, tasks });
    // 2026-07-06 is a Monday.
    const monday = r.ticks.find((t) => t.date === "2026-07-06");
    expect(monday?.major).toBe(true);
    const tuesday = r.ticks.find((t) => t.date === "2026-07-07");
    expect(tuesday?.major).toBe(false);
  });

  it("builds top-level month segments in day view", () => {
    const tasks = [task({ id: "a", start: "2026-07-28", end: "2026-08-03", order: 0 })];
    const r = computeLayout({ ...base, tasks });
    const labels = r.axisTop.map((s) => s.label);
    expect(labels).toContain("juillet 2026");
    expect(labels).toContain("août 2026");
  });

  it("builds year segments in month view", () => {
    const tasks = [task({ id: "a", start: "2025-11-01", end: "2026-02-01", order: 0 })];
    const r = computeLayout({
      ...base,
      tasks,
      unit: "month",
      pxPerDay: pxPerDayForUnit("month"),
    });
    const labels = r.axisTop.map((s) => s.label);
    expect(labels).toContain("2025");
    expect(labels).toContain("2026");
  });
});

describe("computeLayout - milestones", () => {
  it("renders a milestone as a single-day cell with no progress", () => {
    const tasks = [
      task({ id: "m", start: "2026-07-10", end: "2026-07-10", order: 0, kind: "milestone", progress: 0.5 }),
    ];
    const r = computeLayout({ ...base, tasks });
    expect(r.bars[0].milestone).toBe(true);
    expect(r.bars[0].width).toBe(40);
    expect(r.bars[0].progressWidth).toBe(0);
    expect(r.bars[0].cy).toBe(44 / 2);
  });

  it("scales progressWidth with the bar", () => {
    const tasks = [
      task({ id: "a", start: "2026-07-10", end: "2026-07-14", order: 0, progress: 0.5 }),
    ];
    const r = computeLayout({ ...base, tasks });
    expect(r.bars[0].progressWidth).toBe(r.bars[0].width / 2);
  });

  it("clamps out-of-range progress", () => {
    const tasks = [
      task({ id: "a", start: "2026-07-10", end: "2026-07-14", order: 0, progress: 4 }),
      task({ id: "b", start: "2026-07-10", end: "2026-07-14", order: 1, progress: -2 }),
    ];
    const r = computeLayout({ ...base, tasks });
    expect(r.bars[0].progressWidth).toBe(r.bars[0].width);
    expect(r.bars[1].progressWidth).toBe(0);
  });
});

describe("computeLayout - dependency links", () => {
  const a = task({ id: "a", start: "2026-07-10", end: "2026-07-12", order: 0 });

  it("routes a forward link from the predecessor's end to the successor's start", () => {
    const b = task({ id: "b", start: "2026-07-16", end: "2026-07-18", order: 1, deps: ["a"] });
    const r = computeLayout({ ...base, tasks: [a, b] });
    expect(r.links).toHaveLength(1);
    const points = r.links[0].points;
    expect(r.links[0]).toMatchObject({ fromId: "a", toId: "b" });
    expect(points[0]).toEqual({ x: r.bars[0].x + r.bars[0].width, y: r.bars[0].cy });
    expect(points[points.length - 1]).toEqual({ x: r.bars[1].x, y: r.bars[1].cy });
  });

  it("detours through the row gutter when the successor starts too early", () => {
    const b = task({ id: "b", start: "2026-07-10", end: "2026-07-11", order: 1, deps: ["a"] });
    const r = computeLayout({ ...base, tasks: [a, b] });
    // The tight route needs the extra vertical dogleg.
    expect(r.links[0].points).toHaveLength(6);
  });

  it("drops links pointing at a missing task or at itself", () => {
    const b = task({ id: "b", start: "2026-07-16", end: "2026-07-18", order: 1, deps: ["ghost", "b"] });
    const r = computeLayout({ ...base, tasks: [a, b] });
    expect(r.links).toHaveLength(0);
  });
});

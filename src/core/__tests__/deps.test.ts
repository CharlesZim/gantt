import { describe, expect, it } from "vitest";
import { earliestStart, pruneDeps, wouldCreateCycle } from "../deps";
import type { Task } from "../types";

function task(id: string, deps?: string[], start = "2026-07-01", end = "2026-07-05"): Task {
  return { id, name: id, start, end, colorKey: 0, order: 0, deps };
}

describe("wouldCreateCycle", () => {
  it("rejects a self-edge", () => {
    expect(wouldCreateCycle([task("a")], "a", "a")).toBe(true);
  });

  it("allows an edge that keeps the graph acyclic", () => {
    const tasks = [task("a"), task("b")];
    expect(wouldCreateCycle(tasks, "b", "a")).toBe(false);
  });

  it("rejects a direct back-edge", () => {
    const tasks = [task("a"), task("b", ["a"])];
    // a already depends on nothing, but b depends on a — so a -> b closes a loop.
    expect(wouldCreateCycle(tasks, "a", "b")).toBe(true);
  });

  it("rejects an indirect back-edge through a chain", () => {
    const tasks = [task("a"), task("b", ["a"]), task("c", ["b"])];
    expect(wouldCreateCycle(tasks, "a", "c")).toBe(true);
  });

  it("terminates on an already-cyclic graph rather than looping forever", () => {
    const tasks = [task("a", ["b"]), task("b", ["a"])];
    expect(wouldCreateCycle(tasks, "a", "b")).toBe(true);
  });
});

describe("pruneDeps", () => {
  it("drops ids with no matching task", () => {
    const tasks = [task("a"), task("b", ["a", "ghost"])];
    expect(pruneDeps(tasks)[1].deps).toEqual(["a"]);
  });

  it("drops a self-reference and collapses an empty list to undefined", () => {
    const tasks = [task("a", ["a"])];
    expect(pruneDeps(tasks)[0].deps).toBeUndefined();
  });

  it("returns the same object when nothing changes", () => {
    const tasks = [task("a"), task("b", ["a"])];
    const pruned = pruneDeps(tasks);
    expect(pruned[1]).toBe(tasks[1]);
  });
});

describe("earliestStart", () => {
  it("is null without predecessors", () => {
    expect(earliestStart([task("a")], "a")).toBeNull();
  });

  it("is the latest predecessor end", () => {
    const tasks = [
      task("a", undefined, "2026-07-01", "2026-07-05"),
      task("b", undefined, "2026-07-01", "2026-07-09"),
      task("c", ["a", "b"]),
    ];
    expect(earliestStart(tasks, "c")).toBe("2026-07-09");
  });
});

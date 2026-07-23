// Dependency-graph helpers. Pure — no React, no DOM.
import type { Task } from "./types";

/**
 * Would adding "`taskId` depends on `depId`" close a cycle?
 * True when `taskId` is already reachable from `depId` through the existing
 * edges (or when the two are the same task).
 */
export function wouldCreateCycle(tasks: Task[], taskId: string, depId: string): boolean {
  if (taskId === depId) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // Walk the predecessors of depId; if we reach taskId, the edge closes a loop.
  const seen = new Set<string>();
  const stack = [depId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of byId.get(current)?.deps ?? []) stack.push(next);
  }
  return false;
}

/** Drop dependency ids that no longer point at an existing task. */
export function pruneDeps(tasks: Task[]): Task[] {
  const ids = new Set(tasks.map((t) => t.id));
  return tasks.map((t) => {
    if (!t.deps || t.deps.length === 0) return t;
    const kept = t.deps.filter((d) => d !== t.id && ids.has(d));
    if (kept.length === t.deps.length) return t;
    return { ...t, deps: kept.length > 0 ? kept : undefined };
  });
}

/**
 * The earliest start a task may take without violating its finish-to-start
 * predecessors, or null when it has none. Used to flag scheduling conflicts.
 */
export function earliestStart(tasks: Task[], taskId: string): string | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const task = byId.get(taskId);
  if (!task?.deps?.length) return null;
  let latestEnd: string | null = null;
  for (const depId of task.deps) {
    const dep = byId.get(depId);
    if (!dep) continue;
    if (latestEnd === null || dep.end > latestEnd) latestEnd = dep.end;
  }
  return latestEnd;
}

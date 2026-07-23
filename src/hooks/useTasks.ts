import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDaysISO, clampISO, daysBetween, todayISO } from "../core/dates";
import { pruneDeps, wouldCreateCycle } from "../core/deps";
import type { GanttState, Task, TaskKind, TimeUnit } from "../core/types";
import { DEFAULT_THEME_ID } from "../themes/themes";

const STORAGE_KEY = "gantt.v1";
const HISTORY_LIMIT = 60;
/** Consecutive edits sharing a merge key coalesce into one undo step. */
const MERGE_WINDOW_MS = 700;

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function seedState(): GanttState {
  const today = todayISO();
  const mk = (
    name: string,
    startOffset: number,
    len: number,
    colorKey: number,
    order: number,
    extra: Partial<Task> = {},
  ): Task => ({
    id: makeId(),
    name,
    start: addDaysISO(today, startOffset),
    end: addDaysISO(today, startOffset + len - 1),
    colorKey,
    order,
    kind: "task",
    ...extra,
  });

  const cadrage = mk("Cadrage & recherche", -3, 5, 0, 0, { progress: 1 });
  const design = mk("Design", 2, 6, 1, 1, { progress: 0.6, deps: [cadrage.id] });
  const dev = mk("Développement", 5, 10, 2, 2, { progress: 0.25, deps: [design.id] });
  const qa = mk("Recette & QA", 14, 4, 3, 3, { deps: [dev.id] });
  const launch = mk("Lancement", 18, 1, 4, 4, { kind: "milestone", deps: [qa.id] });

  return {
    title: "Mon projet",
    themeId: DEFAULT_THEME_ID,
    unit: "day",
    tasks: [cadrage, design, dev, qa, launch],
  };
}

/** Normalize a task: end >= start, milestones are single-day, progress in [0,1]. */
function normalizeTask(t: Task): Task {
  const kind: TaskKind = t.kind === "milestone" ? "milestone" : "task";
  const end =
    kind === "milestone" ? t.start : daysBetween(t.start, t.end) < 0 ? t.start : t.end;
  const progress =
    typeof t.progress === "number" && !Number.isNaN(t.progress)
      ? Math.min(1, Math.max(0, t.progress))
      : undefined;
  return { ...t, kind, end, progress };
}

function normalizeState(s: GanttState): GanttState {
  return { ...s, tasks: pruneDeps(s.tasks.map(normalizeTask)) };
}

export function loadState(): GanttState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as GanttState;
    if (!parsed || !Array.isArray(parsed.tasks)) return seedState();
    return normalizeState({
      title: parsed.title ?? "Mon projet",
      themeId: parsed.themeId ?? DEFAULT_THEME_ID,
      unit: parsed.unit ?? "day",
      tasks: parsed.tasks.map((t, i) => ({ ...t, order: t.order ?? i })),
    });
  } catch {
    return seedState();
  }
}

export interface UseTasks {
  state: GanttState;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addTask: (kind?: TaskKind) => string;
  duplicateTask: (id: string) => string | null;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  reorderTasks: (fromId: string, toIndex: number) => void;
  setKind: (id: string, kind: TaskKind) => void;
  setProgress: (id: string, progress: number) => void;
  toggleDep: (taskId: string, depId: string) => void;
  setTitle: (title: string) => void;
  setThemeId: (themeId: string) => void;
  setUnit: (unit: TimeUnit) => void;
  moveBar: (id: string, deltaDays: number) => void;
  resizeStart: (id: string, newStart: string) => void;
  resizeEnd: (id: string, newEnd: string) => void;
  replaceAll: (state: GanttState) => void;
}

interface History {
  past: GanttState[];
  present: GanttState;
  future: GanttState[];
}

export function useTasks(): UseTasks {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: loadState(),
    future: [],
  }));
  const firstRun = useRef(true);
  const lastMerge = useRef<{ key: string; at: number } | null>(null);

  const state = history.present;

  // Persist the current state on any change (after the initial mount).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — ignore */
    }
  }, [state]);

  /**
   * Apply a state transition and push an undo entry.
   * `mergeKey` coalesces a burst of related edits (typing, sliding a progress
   * handle) into a single undo step.
   */
  const commit = useCallback((fn: (s: GanttState) => GanttState, mergeKey?: string) => {
    const now = Date.now();
    const merges =
      mergeKey !== undefined &&
      lastMerge.current?.key === mergeKey &&
      now - lastMerge.current.at < MERGE_WINDOW_MS;
    lastMerge.current = mergeKey !== undefined ? { key: mergeKey, at: now } : null;

    setHistory((h) => {
      const next = fn(h.present);
      if (next === h.present) return h;
      const past = merges ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
      return { past, present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    lastMerge.current = null;
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastMerge.current = null;
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
      };
    });
  }, []);

  const addTask = useCallback(
    (kind: TaskKind = "task"): string => {
      const id = makeId();
      commit((s) => {
        const order = s.tasks.length;
        const today = todayISO();
        const task = normalizeTask({
          id,
          name: "",
          start: today,
          end: addDaysISO(today, kind === "milestone" ? 0 : 3),
          colorKey: order % 8,
          order,
          kind,
        });
        return { ...s, tasks: [...s.tasks, task] };
      });
      return id;
    },
    [commit],
  );

  const duplicateTask = useCallback(
    (id: string): string | null => {
      const newId = makeId();
      let created = false;
      commit((s) => {
        const ordered = [...s.tasks].sort((a, b) => a.order - b.order);
        const index = ordered.findIndex((t) => t.id === id);
        if (index === -1) return s;
        const source = ordered[index];
        const copy: Task = {
          ...source,
          id: newId,
          name: source.name ? `${source.name} (copie)` : "",
          deps: undefined,
        };
        ordered.splice(index + 1, 0, copy);
        created = true;
        return { ...s, tasks: ordered.map((t, i) => ({ ...t, order: i })) };
      });
      return created ? newId : null;
    },
    [commit],
  );

  const patchTask = useCallback(
    (id: string, patch: Partial<Task>, mergeKey?: string) => {
      commit(
        (s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? normalizeTask({ ...t, ...patch }) : t)),
        }),
        mergeKey,
      );
    },
    [commit],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      // Name edits arrive keystroke by keystroke; collapse them into one step.
      const mergeKey = "name" in patch ? `name:${id}` : undefined;
      patchTask(id, patch, mergeKey);
    },
    [patchTask],
  );

  const removeTask = useCallback(
    (id: string) => {
      commit((s) => {
        const remaining = s.tasks
          .filter((t) => t.id !== id)
          .sort((a, b) => a.order - b.order)
          .map((t, i) => ({ ...t, order: i }));
        return { ...s, tasks: pruneDeps(remaining) };
      });
    },
    [commit],
  );

  const reorderTasks = useCallback(
    (fromId: string, toIndex: number) => {
      commit((s) => {
        const ordered = [...s.tasks].sort((a, b) => a.order - b.order);
        const fromIndex = ordered.findIndex((t) => t.id === fromId);
        if (fromIndex === -1) return s;
        const [moved] = ordered.splice(fromIndex, 1);
        const clamped = Math.max(0, Math.min(toIndex, ordered.length));
        if (clamped === fromIndex) return s;
        ordered.splice(clamped, 0, moved);
        return { ...s, tasks: ordered.map((t, i) => ({ ...t, order: i })) };
      });
    },
    [commit],
  );

  const setKind = useCallback((id: string, kind: TaskKind) => patchTask(id, { kind }), [patchTask]);

  const setProgress = useCallback(
    (id: string, progress: number) => patchTask(id, { progress }, `progress:${id}`),
    [patchTask],
  );

  /** Add or remove a finish-to-start edge. Cycle-forming edges are ignored. */
  const toggleDep = useCallback(
    (taskId: string, depId: string) => {
      commit((s) => {
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task) return s;
        const current = task.deps ?? [];
        const has = current.includes(depId);
        if (!has && wouldCreateCycle(s.tasks, taskId, depId)) return s;
        const next = has ? current.filter((d) => d !== depId) : [...current, depId];
        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, deps: next.length > 0 ? next : undefined } : t,
          ),
        };
      });
    },
    [commit],
  );

  const setTitle = useCallback(
    (title: string) => commit((s) => (s.title === title ? s : { ...s, title }), "title"),
    [commit],
  );
  const setThemeId = useCallback(
    (themeId: string) => commit((s) => (s.themeId === themeId ? s : { ...s, themeId })),
    [commit],
  );
  const setUnit = useCallback(
    (unit: TimeUnit) => commit((s) => (s.unit === unit ? s : { ...s, unit })),
    [commit],
  );

  const moveBar = useCallback(
    (id: string, deltaDays: number) => {
      if (deltaDays === 0) return;
      commit((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id
            ? normalizeTask({
                ...t,
                start: addDaysISO(t.start, deltaDays),
                end: addDaysISO(t.end, deltaDays),
              })
            : t,
        ),
      }));
    },
    [commit],
  );

  const resizeStart = useCallback(
    (id: string, newStart: string) => {
      commit((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? normalizeTask({ ...t, start: clampISO(newStart, undefined, t.end) }) : t,
        ),
      }));
    },
    [commit],
  );

  const resizeEnd = useCallback(
    (id: string, newEnd: string) => {
      commit((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? normalizeTask({ ...t, end: clampISO(newEnd, t.start, undefined) }) : t,
        ),
      }));
    },
    [commit],
  );

  const replaceAll = useCallback(
    (next: GanttState) => commit(() => normalizeState(next)),
    [commit],
  );

  return useMemo(
    () => ({
      state,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      undo,
      redo,
      addTask,
      duplicateTask,
      updateTask,
      removeTask,
      reorderTasks,
      setKind,
      setProgress,
      toggleDep,
      setTitle,
      setThemeId,
      setUnit,
      moveBar,
      resizeStart,
      resizeEnd,
      replaceAll,
    }),
    [
      state,
      history.past.length,
      history.future.length,
      undo,
      redo,
      addTask,
      duplicateTask,
      updateTask,
      removeTask,
      reorderTasks,
      setKind,
      setProgress,
      toggleDep,
      setTitle,
      setThemeId,
      setUnit,
      moveBar,
      resizeStart,
      resizeEnd,
      replaceAll,
    ],
  );
}

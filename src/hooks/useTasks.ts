import { useCallback, useEffect, useRef, useState } from "react";
import { addDaysISO, clampISO, daysBetween, todayISO } from "../core/dates";
import type { GanttState, Task, TimeUnit } from "../core/types";
import { DEFAULT_THEME_ID } from "../themes/themes";

const STORAGE_KEY = "gantt.v1";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function seedState(): GanttState {
  const today = todayISO();
  const mk = (name: string, startOffset: number, len: number, colorKey: number, order: number): Task => ({
    id: makeId(),
    name,
    start: addDaysISO(today, startOffset),
    end: addDaysISO(today, startOffset + len - 1),
    colorKey,
    order,
  });
  return {
    title: "Mon projet",
    themeId: DEFAULT_THEME_ID,
    unit: "day",
    tasks: [
      mk("Cadrage & recherche", -3, 5, 0, 0),
      mk("Design", 2, 6, 1, 1),
      mk("Développement", 5, 10, 2, 2),
      mk("Recette & QA", 14, 4, 3, 3),
      mk("Lancement", 18, 2, 4, 4),
    ],
  };
}

function loadState(): GanttState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as GanttState;
    if (!parsed || !Array.isArray(parsed.tasks)) return seedState();
    return {
      title: parsed.title ?? "Mon projet",
      themeId: parsed.themeId ?? DEFAULT_THEME_ID,
      unit: parsed.unit ?? "day",
      tasks: parsed.tasks.map((t, i) => ({ ...t, order: t.order ?? i })),
    };
  } catch {
    return seedState();
  }
}

/** Normalize a task so end is always >= start (min 1 day). */
function normalizeTask(t: Task): Task {
  const end = daysBetween(t.start, t.end) < 0 ? t.start : t.end;
  return { ...t, end };
}

export interface UseTasks {
  state: GanttState;
  addTask: () => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  reorderTasks: (fromId: string, toIndex: number) => void;
  setTitle: (title: string) => void;
  setThemeId: (themeId: string) => void;
  setUnit: (unit: TimeUnit) => void;
  moveBar: (id: string, deltaDays: number) => void;
  resizeStart: (id: string, newStart: string) => void;
  resizeEnd: (id: string, newEnd: string) => void;
  replaceAll: (state: GanttState) => void;
}

export function useTasks(): UseTasks {
  const [state, setState] = useState<GanttState>(loadState);
  const firstRun = useRef(true);

  // Persist the whole state on any change (after the initial mount).
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

  const addTask = useCallback((): string => {
    const id = makeId();
    setState((s) => {
      const order = s.tasks.length;
      const today = todayISO();
      const colorKey = order % 8;
      const task: Task = {
        id,
        name: "",
        start: today,
        end: addDaysISO(today, 3),
        colorKey,
        order,
      };
      return { ...s, tasks: [...s.tasks, task] };
    });
    return id;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? normalizeTask({ ...t, ...patch }) : t)),
    }));
  }, []);

  const removeTask = useCallback((id: string) => {
    setState((s) => {
      const remaining = s.tasks
        .filter((t) => t.id !== id)
        .sort((a, b) => a.order - b.order)
        .map((t, i) => ({ ...t, order: i }));
      return { ...s, tasks: remaining };
    });
  }, []);

  const reorderTasks = useCallback((fromId: string, toIndex: number) => {
    setState((s) => {
      const ordered = [...s.tasks].sort((a, b) => a.order - b.order);
      const fromIndex = ordered.findIndex((t) => t.id === fromId);
      if (fromIndex === -1) return s;
      const [moved] = ordered.splice(fromIndex, 1);
      const clamped = Math.max(0, Math.min(toIndex, ordered.length));
      ordered.splice(clamped, 0, moved);
      return { ...s, tasks: ordered.map((t, i) => ({ ...t, order: i })) };
    });
  }, []);

  const setTitle = useCallback((title: string) => setState((s) => ({ ...s, title })), []);
  const setThemeId = useCallback((themeId: string) => setState((s) => ({ ...s, themeId })), []);
  const setUnit = useCallback((unit: TimeUnit) => setState((s) => ({ ...s, unit })), []);

  const moveBar = useCallback((id: string, deltaDays: number) => {
    if (deltaDays === 0) return;
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, start: addDaysISO(t.start, deltaDays), end: addDaysISO(t.end, deltaDays) }
          : t,
      ),
    }));
  }, []);

  const resizeStart = useCallback((id: string, newStart: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, start: clampISO(newStart, undefined, t.end) } : t,
      ),
    }));
  }, []);

  const resizeEnd = useCallback((id: string, newEnd: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, end: clampISO(newEnd, t.start, undefined) } : t,
      ),
    }));
  }, []);

  const replaceAll = useCallback((next: GanttState) => setState(next), []);

  return {
    state,
    addTask,
    updateTask,
    removeTask,
    reorderTasks,
    setTitle,
    setThemeId,
    setUnit,
    moveBar,
    resizeStart,
    resizeEnd,
    replaceAll,
  };
}

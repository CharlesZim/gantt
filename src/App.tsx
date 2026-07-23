import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ExportModal } from "./components/ExportModal";
import { GanttChart } from "./components/GanttChart";
import { TaskInspector } from "./components/TaskInspector";
import { TaskList } from "./components/TaskList";
import { TimeAxis } from "./components/TimeAxis";
import { Toolbar } from "./components/Toolbar";
import { BAR_HEIGHT, PAD_DAYS, ROW_HEIGHT } from "./core/config";
import { spanDays } from "./core/dates";
import { computeLayout, PX_PER_DAY, pxPerDayForUnit } from "./core/layout";
import type { TimeUnit } from "./core/types";
import { useTasks } from "./hooks/useTasks";
import { applyTheme, counterpartThemeId, getTheme } from "./themes/themes";

const UNIT_ORDER: TimeUnit[] = ["month", "week", "day"];

export default function App() {
  const {
    state,
    canUndo,
    canRedo,
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
  } = useTasks();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewport, setViewport] = useState({ left: 0, width: 0 });

  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  // Guards the two-way scroll mirroring between the two panes.
  const syncing = useRef(false);

  const theme = getTheme(state.themeId);
  const pxPerDay = pxPerDayForUnit(state.unit);

  const orderedTasks = useMemo(
    () => [...state.tasks].sort((a, b) => a.order - b.order),
    [state.tasks],
  );

  const layout = useMemo(
    () =>
      computeLayout({
        tasks: orderedTasks,
        unit: state.unit,
        rowHeight: ROW_HEIGHT,
        barHeight: BAR_HEIGHT,
        pxPerDay,
        padDays: PAD_DAYS,
      }),
    [orderedTasks, state.unit, pxPerDay],
  );

  const selectedTask = useMemo(
    () => orderedTasks.find((t) => t.id === selectedId) ?? null,
    [orderedTasks, selectedId],
  );

  // Apply the active theme's CSS variables.
  useEffect(() => {
    applyTheme(theme, document.documentElement);
  }, [theme]);

  // Track the horizontal scroll window so the chart can cull off-screen grid
  // lines instead of rendering a year of day columns at once.
  const syncViewport = useCallback(() => {
    const el = rightScrollRef.current;
    if (el) setViewport({ left: el.scrollLeft, width: el.clientWidth });
  }, []);

  useLayoutEffect(() => {
    syncViewport();
    const el = rightScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(syncViewport);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncViewport]);

  /** Mirror vertical scroll between the two panes, whichever one moved. */
  const mirrorScroll = useCallback(
    (from: "left" | "right") => {
      if (syncing.current) return;
      const left = leftBodyRef.current;
      const right = rightScrollRef.current;
      if (!left || !right) return;
      syncing.current = true;
      if (from === "right") {
        left.scrollTop = right.scrollTop;
        syncViewport();
      } else {
        right.scrollTop = left.scrollTop;
      }
      requestAnimationFrame(() => {
        syncing.current = false;
      });
    },
    [syncViewport],
  );

  const handleAdd = useCallback(
    (kind: "task" | "milestone" = "task") => {
      const id = addTask(kind);
      setSelectedId(id);
      setFocusId(id);
      requestAnimationFrame(() => {
        const el = rightScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
    [addTask],
  );

  const handleRemove = useCallback(
    (id: string) => {
      removeTask(id);
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [removeTask],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const newId = duplicateTask(id);
      if (newId) setSelectedId(newId);
    },
    [duplicateTask],
  );

  /** Scroll the timeline so today sits a third of the way in. */
  const scrollToToday = useCallback(() => {
    const el = rightScrollRef.current;
    if (!el || layout.todayX === null) return;
    el.scrollTo({ left: Math.max(0, layout.todayX - el.clientWidth / 3), behavior: "smooth" });
  }, [layout.todayX]);

  /**
   * Pick the finest zoom whose full span still fits the pane.
   *
   * Zoom stays quantised to the three units rather than being continuous, so
   * what is on screen is exactly what `buildSvg` renders — the export pipeline
   * derives its scale from the same unit.
   */
  const fitToWindow = useCallback(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    const days = spanDays(layout.rangeStart, layout.rangeEnd);
    const width = el.clientWidth;
    const best = UNIT_ORDER.find((u) => days * PX_PER_DAY[u] <= width) ?? "month";
    setUnit(best);
    requestAnimationFrame(() => el.scrollTo({ left: 0, behavior: "smooth" }));
  }, [layout.rangeStart, layout.rangeEnd, setUnit]);

  /** Ctrl/⌘ + wheel steps through the zoom units, like a map. */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const index = UNIT_ORDER.indexOf(state.unit);
      const next = e.deltaY < 0 ? index + 1 : index - 1;
      if (next >= 0 && next < UNIT_ORDER.length) setUnit(UNIT_ORDER[next]);
    },
    [state.unit, setUnit],
  );

  // Global shortcuts. Deleting is undoable, so it needs no confirmation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (typing) return;

      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleRemove(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, handleRemove, undo, redo]);

  const isEmpty = state.tasks.length === 0;
  const c = theme.colors;

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: c.background }}>
      <Toolbar
        title={state.title}
        unit={state.unit}
        theme={theme}
        canUndo={canUndo}
        canRedo={canRedo}
        onTitleChange={setTitle}
        onUnitChange={setUnit}
        onThemeChange={setThemeId}
        onToggleDark={() => setThemeId(counterpartThemeId(theme.id))}
        onUndo={undo}
        onRedo={redo}
        onFit={fitToWindow}
        onToday={scrollToToday}
        onExport={() => setExportOpen(true)}
      />

      <main className="flex min-h-0 flex-1">
        <TaskList
          tasks={orderedTasks}
          theme={theme}
          selectedId={selectedId}
          focusId={focusId}
          onFocusHandled={() => setFocusId(null)}
          bodyRef={leftBodyRef}
          onSelect={setSelectedId}
          onUpdate={updateTask}
          onRemove={handleRemove}
          onAdd={handleAdd}
          onReorder={reorderTasks}
          onScroll={() => mirrorScroll("left")}
        />

        <div className="relative min-w-0 flex-1">
          <div
            ref={rightScrollRef}
            onScroll={() => mirrorScroll("right")}
            onWheel={handleWheel}
            className="thin-scroll h-full overflow-auto"
            style={{ background: c.surface }}
          >
            <div style={{ width: layout.totalWidth, minWidth: "100%" }}>
              <div className="sticky top-0 z-10" style={{ width: layout.totalWidth }}>
                <TimeAxis
                  axisTop={layout.axisTop}
                  ticks={layout.ticks}
                  totalWidth={layout.totalWidth}
                  unit={state.unit}
                  pxPerDay={pxPerDay}
                  theme={theme}
                />
              </div>
              <GanttChart
                tasks={orderedTasks}
                layout={layout}
                theme={theme}
                pxPerDay={pxPerDay}
                selectedId={selectedId}
                viewport={viewport}
                onSelect={setSelectedId}
                onMoveBar={moveBar}
                onResizeStart={resizeStart}
                onResizeEnd={resizeEnd}
              />
            </div>
          </div>

          {selectedTask && (
            <TaskInspector
              task={selectedTask}
              allTasks={orderedTasks}
              theme={theme}
              onUpdate={(patch) => updateTask(selectedTask.id, patch)}
              onSetKind={(kind) => setKind(selectedTask.id, kind)}
              onSetProgress={(p) => setProgress(selectedTask.id, p)}
              onToggleDep={(depId) => toggleDep(selectedTask.id, depId)}
              onDuplicate={() => handleDuplicate(selectedTask.id)}
              onRemove={() => handleRemove(selectedTask.id)}
              onClose={() => setSelectedId(null)}
            />
          )}

          {isEmpty && (
            <EmptyState
              color={c.accent}
              muted={c.textMuted}
              text={c.text}
              onAccent={c.onAccent}
              onAdd={() => handleAdd("task")}
            />
          )}
        </div>
      </main>

      <ExportModal
        open={exportOpen}
        state={state}
        currentThemeId={state.themeId}
        uiTheme={theme}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

function EmptyState({
  color,
  muted,
  text,
  onAccent,
  onAdd,
}: {
  color: string;
  muted: string;
  text: string;
  onAccent: string;
  onAdd: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-sm flex-col items-center text-center">
        <div
          className="mb-4 grid h-16 w-16 place-items-center rounded-2xl"
          style={{ background: `${color}22`, color }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </div>
        <h2 className="mb-1 text-lg font-bold" style={{ color: text }}>
          Aucune tâche pour l'instant
        </h2>
        <p className="mb-5 text-sm" style={{ color: muted }}>
          Créez votre première tâche pour commencer à planifier votre projet.
        </p>
        <button
          onClick={onAdd}
          className="rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-transform active:scale-95"
          style={{ background: color, color: onAccent }}
        >
          + Ajouter votre première tâche
        </button>
      </div>
    </div>
  );
}

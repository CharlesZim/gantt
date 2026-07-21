import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportModal } from "./components/ExportModal";
import { GanttChart } from "./components/GanttChart";
import { TaskList } from "./components/TaskList";
import { TimeAxis } from "./components/TimeAxis";
import { Toolbar } from "./components/Toolbar";
import { BAR_HEIGHT, PAD_DAYS, ROW_HEIGHT } from "./core/config";
import { computeLayout, pxPerDayForUnit } from "./core/layout";
import { useTasks } from "./hooks/useTasks";
import { applyTheme, getTheme } from "./themes/themes";

export default function App() {
  const {
    state,
    addTask,
    updateTask,
    removeTask,
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

  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

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

  // Apply the active theme's CSS variables.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    applyTheme(theme, root);
  }, [theme]);

  // Keep the task-name column vertically in sync with the chart scroll.
  const handleScroll = useCallback(() => {
    if (leftBodyRef.current && rightScrollRef.current) {
      leftBodyRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
  }, []);

  const handleAdd = useCallback(() => {
    const id = addTask();
    setSelectedId(id);
    setFocusId(id);
    // Scroll the new (bottom) task into view.
    requestAnimationFrame(() => {
      const el = rightScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [addTask]);

  const handleRemove = useCallback(
    (id: string) => {
      removeTask(id);
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [removeTask],
  );

  // Delete / Backspace removes the selected task (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable;
      if (typing) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleRemove(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, handleRemove]);

  const isEmpty = state.tasks.length === 0;
  const c = theme.colors;

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: c.background }}>
      <Toolbar
        title={state.title}
        unit={state.unit}
        theme={theme}
        onTitleChange={setTitle}
        onUnitChange={setUnit}
        onToggleDark={() =>
          setThemeId(
            theme.id === "dark" || theme.id === "blueprint" ? "light" : "dark",
          )
        }
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
        />

        <div className="relative min-w-0 flex-1">
          <div
            ref={rightScrollRef}
            onScroll={handleScroll}
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
                onSelect={setSelectedId}
                onMoveBar={moveBar}
                onResizeStart={resizeStart}
                onResizeEnd={resizeEnd}
              />
            </div>
          </div>

          {isEmpty && <EmptyState color={theme.barPalette[0]} muted={c.textMuted} text={c.text} onAdd={handleAdd} />}
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
  onAdd,
}: {
  color: string;
  muted: string;
  text: string;
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
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
          style={{ background: color }}
        >
          + Ajouter votre première tâche
        </button>
      </div>
    </div>
  );
}

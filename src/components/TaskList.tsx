import { useEffect, useRef, useState, type RefObject } from "react";
import { AXIS_HEIGHT, ROW_HEIGHT, TASK_LIST_WIDTH } from "../core/config";
import type { Task } from "../core/types";
import type { Theme } from "../themes/types";

interface TaskListProps {
  tasks: Task[]; // already ordered
  theme: Theme;
  selectedId: string | null;
  focusId: string | null;
  onFocusHandled: () => void;
  bodyRef: RefObject<HTMLDivElement>;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export function TaskList({
  tasks,
  theme,
  selectedId,
  focusId,
  onFocusHandled,
  bodyRef,
  onSelect,
  onUpdate,
  onRemove,
  onAdd,
}: TaskListProps) {
  const c = theme.colors;

  return (
    <div
      className="flex h-full flex-col border-r"
      style={{ width: TASK_LIST_WIDTH, minWidth: TASK_LIST_WIDTH, borderColor: c.gridLine, background: c.surface }}
    >
      {/* Header aligned with the time axis. */}
      <div
        className="flex items-center justify-between px-4"
        style={{ height: AXIS_HEIGHT, borderBottom: `1px solid ${c.gridLineStrong}` }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>
          Tâches · {tasks.length}
        </span>
        <button
          onClick={onAdd}
          className="rounded-md px-2.5 py-1 text-xs font-semibold text-white transition-transform active:scale-95"
          style={{ background: theme.barPalette[0] }}
        >
          + Tâche
        </button>
      </div>

      {/* Scrollable body (vertical scroll driven by the chart pane). */}
      <div ref={bodyRef} className="flex-1 overflow-hidden">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            theme={theme}
            selected={task.id === selectedId}
            autoFocus={task.id === focusId}
            onFocusHandled={onFocusHandled}
            onSelect={() => onSelect(task.id)}
            onUpdate={(patch) => onUpdate(task.id, patch)}
            onRemove={() => onRemove(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  theme: Theme;
  selected: boolean;
  autoFocus: boolean;
  onFocusHandled: () => void;
  onSelect: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onRemove: () => void;
}

function TaskRow({
  task,
  theme,
  selected,
  autoFocus,
  onFocusHandled,
  onSelect,
  onUpdate,
  onRemove,
}: TaskRowProps) {
  const c = theme.colors;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setEditing(true);
      onFocusHandled();
    }
  }, [autoFocus, onFocusHandled]);

  useEffect(() => {
    if (editing) {
      setDraft(task.name);
      // Focus after paint.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    onUpdate({ name: draft.trim() || "Sans titre" });
    setEditing(false);
  };

  const cycleColor = () => {
    onUpdate({ colorKey: (task.colorKey + 1) % theme.barPalette.length });
  };

  return (
    <div
      className="gantt-row-hover group relative flex flex-col justify-center px-4"
      style={{
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${c.gridLine}`,
        background: selected ? withAlpha(c.todayMarker, 0.06) : "transparent",
      }}
      onPointerDown={onSelect}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            cycleColor();
          }}
          title="Changer la couleur"
          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110"
          style={{ background: theme.barPalette[task.colorKey % theme.barPalette.length] }}
        />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(task.name);
                setEditing(false);
              }
            }}
            className="w-full rounded border bg-transparent px-1.5 py-0.5 text-sm outline-none"
            style={{ borderColor: theme.barPalette[0], color: c.text }}
          />
        ) : (
          <button
            className="truncate text-left text-sm font-medium"
            style={{ color: task.name ? c.text : c.textMuted }}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            title={task.name}
          >
            {task.name || "Sans titre"}
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Supprimer"
          className="ml-auto hidden shrink-0 rounded p-1 text-muted transition-colors hover:text-red-500 group-hover:block"
          style={{ color: c.textMuted }}
        >
          <TrashIcon />
        </button>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="date"
          value={task.start}
          max={task.end}
          onChange={(e) => e.target.value && onUpdate({ start: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="rounded bg-transparent px-1 py-0.5 text-[11px] tabular-nums outline-none"
          style={{ color: c.textMuted, colorScheme: theme.id === "dark" || theme.id === "blueprint" ? "dark" : "light" }}
        />
        <span className="text-[11px]" style={{ color: c.textMuted }}>
          →
        </span>
        <input
          type="date"
          value={task.end}
          min={task.start}
          onChange={(e) => e.target.value && onUpdate({ end: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="rounded bg-transparent px-1 py-0.5 text-[11px] tabular-nums outline-none"
          style={{ color: c.textMuted, colorScheme: theme.id === "dark" || theme.id === "blueprint" ? "dark" : "light" }}
        />
      </div>
    </div>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

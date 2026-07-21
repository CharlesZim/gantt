import { useEffect, useRef, useState, type RefObject } from "react";
import { resolveTaskColor } from "../core/color";
import { AXIS_HEIGHT, ROW_HEIGHT } from "../core/config";
import type { Task } from "../core/types";
import type { Theme } from "../themes/types";
import { ColorPicker } from "./ColorPicker";

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
      className="flex h-full w-[176px] shrink-0 flex-col border-r sm:w-[280px]"
      style={{ borderColor: c.gridLine, background: c.surface }}
    >
      {/* Header aligned with the time axis. */}
      <div
        className="flex items-center justify-between gap-2 px-3 sm:px-4"
        style={{ height: AXIS_HEIGHT, borderBottom: `1px solid ${c.gridLineStrong}` }}
      >
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>
          Tâches · {tasks.length}
        </span>
        <button
          onClick={onAdd}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95"
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
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dotRef = useRef<HTMLButtonElement>(null);

  const dark = theme.id === "dark" || theme.id === "blueprint";
  const resolvedColor = resolveTaskColor(task, theme.barPalette);

  useEffect(() => {
    if (autoFocus) {
      setEditing(true);
      onFocusHandled();
    }
  }, [autoFocus, onFocusHandled]);

  useEffect(() => {
    if (editing) {
      setDraft(task.name);
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

  return (
    <div
      className="gantt-row-hover group relative flex flex-col justify-center px-3 sm:px-4"
      style={{
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${c.gridLine}`,
        background: selected ? withAlpha(c.todayMarker, 0.06) : "transparent",
      }}
      onPointerDown={onSelect}
    >
      <div className="flex items-center gap-2">
        <button
          ref={dotRef}
          onClick={(e) => {
            e.stopPropagation();
            setPickerRect(dotRef.current?.getBoundingClientRect() ?? null);
          }}
          title="Changer la couleur"
          className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110"
          style={{ background: resolvedColor }}
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
            className="min-w-0 flex-1 truncate text-left text-sm font-medium"
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
          className="ml-auto shrink-0 rounded p-1 opacity-0 transition-opacity hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
          style={{ color: c.textMuted }}
          aria-label="Supprimer la tâche"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="mt-1 flex items-center gap-1">
        <input
          type="date"
          value={task.start}
          max={task.end}
          onChange={(e) => e.target.value && onUpdate({ start: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded bg-transparent py-0.5 text-[10px] tabular-nums outline-none sm:text-[11px]"
          style={{ color: c.textMuted, colorScheme: dark ? "dark" : "light" }}
        />
        <span className="shrink-0 text-[11px]" style={{ color: c.textMuted }}>
          →
        </span>
        <input
          type="date"
          value={task.end}
          min={task.start}
          onChange={(e) => e.target.value && onUpdate({ end: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded bg-transparent py-0.5 text-[10px] tabular-nums outline-none sm:text-[11px]"
          style={{ color: c.textMuted, colorScheme: dark ? "dark" : "light" }}
        />
      </div>

      {pickerRect && (
        <ColorPicker
          anchorRect={pickerRect}
          palette={theme.barPalette}
          currentColor={resolvedColor}
          isCustom={!!task.color}
          theme={theme}
          onPickPreset={(i) => {
            onUpdate({ colorKey: i, color: undefined });
            setPickerRect(null);
          }}
          onPickCustom={(hex) => onUpdate({ color: hex })}
          onClose={() => setPickerRect(null)}
        />
      )}
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

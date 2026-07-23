import { useEffect, useRef, useState, type RefObject } from "react";
import { resolveTaskColor } from "../core/color";
import { AXIS_HEIGHT, ROW_HEIGHT } from "../core/config";
import { isMilestone, taskProgress, type Task, type TaskKind } from "../core/types";
import type { Theme } from "../themes/types";
import { ColorPicker } from "./ColorPicker";
import { withAlpha } from "./util";

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
  onAdd: (kind?: TaskKind) => void;
  onReorder: (fromId: string, toIndex: number) => void;
  onScroll: () => void;
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
  onReorder,
  onScroll,
}: TaskListProps) {
  const c = theme.colors;
  // Row index the dragged row would land on, or null when not dragging.
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const draggingId = useRef<string | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!draggingId.current) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY - rect.top > rect.height / 2;
    setDropIndex(index + (after ? 1 : 0));
  };

  const finishDrag = () => {
    const id = draggingId.current;
    if (id && dropIndex !== null) {
      const from = tasks.findIndex((t) => t.id === id);
      // Removing the row first shifts every later target up by one.
      onReorder(id, dropIndex > from ? dropIndex - 1 : dropIndex);
    }
    draggingId.current = null;
    setDropIndex(null);
  };

  return (
    <div
      className="flex h-full w-[186px] shrink-0 flex-col border-r sm:w-[288px]"
      style={{ borderColor: c.gridLine, background: c.surface }}
    >
      {/* Header aligned with the time axis. */}
      <div
        className="flex items-center justify-between gap-1 px-3 sm:px-4"
        style={{ height: AXIS_HEIGHT, borderBottom: `1px solid ${c.gridLineStrong}` }}
      >
        <span
          className="truncate text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: c.textMuted }}
        >
          Tâches · {tasks.length}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onAdd("milestone")}
            title="Ajouter un jalon"
            aria-label="Ajouter un jalon"
            className="grid h-7 w-7 place-items-center rounded-md transition-colors"
            style={{ color: c.textMuted, border: `1px solid ${c.gridLine}` }}
          >
            <DiamondIcon />
          </button>
          <button
            onClick={() => onAdd("task")}
            className="rounded-md px-2.5 py-1.5 text-xs font-semibold transition-transform active:scale-95"
            style={{ background: c.accent, color: c.onAccent }}
          >
            + Tâche
          </button>
        </div>
      </div>

      {/* Scrollable body. Scrolls on its own AND mirrors the chart pane. */}
      <div
        ref={bodyRef}
        onScroll={onScroll}
        className="no-scrollbar flex-1 overflow-y-auto overscroll-contain"
        onDragEnd={finishDrag}
        onDrop={(e) => {
          e.preventDefault();
          finishDrag();
        }}
      >
        {tasks.map((task, index) => (
          <div
            key={task.id}
            onDragOver={(e) => handleDragOver(e, index)}
            style={{
              borderTop:
                dropIndex === index ? `2px solid ${c.accent}` : "2px solid transparent",
              borderBottom:
                dropIndex === tasks.length && index === tasks.length - 1
                  ? `2px solid ${c.accent}`
                  : "2px solid transparent",
            }}
          >
            <TaskRow
              task={task}
              theme={theme}
              selected={task.id === selectedId}
              autoFocus={task.id === focusId}
              dimmed={draggingId.current === task.id}
              onFocusHandled={onFocusHandled}
              onSelect={() => onSelect(task.id)}
              onUpdate={(patch) => onUpdate(task.id, patch)}
              onRemove={() => onRemove(task.id)}
              onDragStart={(e) => {
                draggingId.current = task.id;
                // Firefox refuses to start a drag unless some data is set.
                e.dataTransfer.setData("text/plain", task.id);
                e.dataTransfer.effectAllowed = "move";
              }}
            />
          </div>
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
  dimmed: boolean;
  onFocusHandled: () => void;
  onSelect: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function TaskRow({
  task,
  theme,
  selected,
  autoFocus,
  dimmed,
  onFocusHandled,
  onSelect,
  onUpdate,
  onRemove,
  onDragStart,
}: TaskRowProps) {
  const c = theme.colors;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dotRef = useRef<HTMLButtonElement>(null);

  const milestone = isMilestone(task);
  const progress = taskProgress(task);
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
      className="gantt-row-hover group relative flex flex-col justify-center px-2 sm:px-3"
      draggable={!editing}
      onDragStart={onDragStart}
      style={{
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${c.gridLine}`,
        background: selected ? withAlpha(c.accent, 0.08) : "transparent",
        opacity: dimmed ? 0.4 : 1,
      }}
      onPointerDown={onSelect}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="shrink-0 cursor-grab opacity-0 transition-opacity group-hover:opacity-60"
          style={{ color: c.textMuted }}
          title="Glisser pour réordonner"
          aria-hidden
        >
          <GripIcon />
        </span>

        <button
          ref={dotRef}
          onClick={(e) => {
            e.stopPropagation();
            setPickerAnchor(dotRef.current);
          }}
          title="Changer la couleur"
          aria-label="Changer la couleur"
          className="shrink-0 transition-transform hover:scale-110"
          style={{ color: resolvedColor }}
        >
          {milestone ? (
            <DiamondIcon filled />
          ) : (
            <span
              className="block h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
              style={{ background: resolvedColor }}
            />
          )}
        </button>

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
            style={{ borderColor: c.accent, color: c.text }}
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

        {progress > 0 && !milestone && (
          <span
            className="shrink-0 tabular-nums text-[10px] font-semibold"
            style={{ color: c.textMuted }}
            title={`${Math.round(progress * 100)} % terminé`}
          >
            {Math.round(progress * 100)}%
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Supprimer"
          className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
          style={{ color: c.textMuted }}
          aria-label="Supprimer la tâche"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="mt-1 flex items-center gap-1 pl-[22px]">
        <input
          type="date"
          value={task.start}
          max={milestone ? undefined : task.end}
          onChange={(e) => e.target.value && onUpdate({ start: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded bg-transparent py-0.5 text-[10px] tabular-nums outline-none sm:text-[11px]"
          style={{ color: c.textMuted, colorScheme: theme.dark ? "dark" : "light" }}
          aria-label="Date de début"
        />
        {!milestone && (
          <>
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
              style={{ color: c.textMuted, colorScheme: theme.dark ? "dark" : "light" }}
              aria-label="Date de fin"
            />
          </>
        )}
        {milestone && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide" style={{ color: c.textMuted }}>
            Jalon
          </span>
        )}
      </div>

      {pickerAnchor && (
        <ColorPicker
          anchor={pickerAnchor}
          palette={theme.barPalette}
          currentColor={resolvedColor}
          isCustom={!!task.color}
          theme={theme}
          onPickPreset={(i) => {
            onUpdate({ colorKey: i, color: undefined });
            setPickerAnchor(null);
          }}
          onPickCustom={(hex) => onUpdate({ color: hex })}
          onClose={() => setPickerAnchor(null)}
        />
      )}
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="3" r="1.2" />
      <circle cx="7.5" cy="3" r="1.2" />
      <circle cx="2.5" cy="7" r="1.2" />
      <circle cx="7.5" cy="7" r="1.2" />
      <circle cx="2.5" cy="11" r="1.2" />
      <circle cx="7.5" cy="11" r="1.2" />
    </svg>
  );
}

function DiamondIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M8 1.5 14.5 8 8 14.5 1.5 8z" />
    </svg>
  );
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

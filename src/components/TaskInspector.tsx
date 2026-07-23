import { useMemo } from "react";
import { resolveTaskColor } from "../core/color";
import { addDaysISO, spanDays } from "../core/dates";
import { wouldCreateCycle } from "../core/deps";
import { dateRangeLabel } from "../core/format";
import { isMilestone, taskProgress, type Task, type TaskKind } from "../core/types";
import type { Theme } from "../themes/types";
import { withAlpha } from "./util";

interface TaskInspectorProps {
  task: Task;
  allTasks: Task[];
  theme: Theme;
  onUpdate: (patch: Partial<Task>) => void;
  onSetKind: (kind: TaskKind) => void;
  onSetProgress: (progress: number) => void;
  onToggleDep: (depId: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Detail panel for the selected task. Holds everything that does not fit in a
 * 46px list row — completion, kind, dependencies — so the list stays scannable.
 */
export function TaskInspector({
  task,
  allTasks,
  theme,
  onUpdate,
  onSetKind,
  onSetProgress,
  onToggleDep,
  onDuplicate,
  onRemove,
  onClose,
}: TaskInspectorProps) {
  const c = theme.colors;
  const milestone = isMilestone(task);
  const progress = taskProgress(task);
  const color = resolveTaskColor(task, theme.barPalette);
  const deps = task.deps ?? [];

  // Only tasks that can legally become predecessors are offered.
  const candidates = useMemo(
    () =>
      allTasks.filter(
        (t) => t.id !== task.id && (deps.includes(t.id) || !wouldCreateCycle(allTasks, task.id, t.id)),
      ),
    [allTasks, task.id, deps],
  );

  const duration = spanDays(task.start, task.end);

  return (
    <aside
      className="pointer-events-auto absolute bottom-3 right-3 z-20 w-[268px] rounded-xl p-3 shadow-2xl sm:w-[300px]"
      style={{ background: c.surface, color: c.text, border: `1px solid ${c.gridLineStrong}` }}
      aria-label="Détails de la tâche"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">
          {task.name || "Sans titre"}
        </span>
        <button
          onClick={onClose}
          aria-label="Fermer le panneau"
          className="rounded p-1"
          style={{ color: c.textMuted }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Kind */}
      <div
        className="mb-3 flex rounded-lg p-0.5"
        style={{ background: c.background, border: `1px solid ${c.gridLine}` }}
        role="radiogroup"
        aria-label="Type"
      >
        {(["task", "milestone"] as const).map((k) => {
          const active = milestone === (k === "milestone");
          return (
            <button
              key={k}
              role="radio"
              aria-checked={active}
              onClick={() => onSetKind(k)}
              className="flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: active ? c.accent : "transparent",
                color: active ? c.onAccent : c.textMuted,
              }}
            >
              {k === "task" ? "Tâche" : "Jalon"}
            </button>
          );
        })}
      </div>

      {/* Dates & duration */}
      <div className="mb-3 text-[11px]" style={{ color: c.textMuted }}>
        {dateRangeLabel(task.start, task.end)}
        {!milestone && <> · {duration} j</>}
      </div>

      {!milestone && (
        <Field label="Durée" theme={theme}>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => {
                const days = Math.max(1, Number(e.target.value) || 1);
                onUpdate({ end: addDaysISO(task.start, days - 1) });
              }}
              className="w-20 rounded-lg border bg-transparent px-2 py-1 text-sm tabular-nums outline-none"
              style={{ borderColor: c.gridLine, color: c.text }}
              aria-label="Durée en jours"
            />
            <span className="text-xs" style={{ color: c.textMuted }}>
              jours
            </span>
          </div>
        </Field>
      )}

      {!milestone && (
        <Field label={`Avancement · ${Math.round(progress * 100)} %`} theme={theme}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(progress * 100)}
            onChange={(e) => onSetProgress(Number(e.target.value) / 100)}
            className="w-full accent-[var(--accent)]"
            aria-label="Avancement en pourcentage"
          />
        </Field>
      )}

      <Field label="Dépend de" theme={theme}>
        {candidates.length === 0 ? (
          <p className="text-xs" style={{ color: c.textMuted }}>
            Aucune autre tâche disponible.
          </p>
        ) : (
          <div className="thin-scroll max-h-28 overflow-y-auto pr-1">
            {candidates.map((t) => {
              const checked = deps.includes(t.id);
              return (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                  style={{ background: checked ? withAlpha(c.accent, 0.08) : "transparent" }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleDep(t.id)}
                    className="accent-[var(--accent)]"
                  />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: resolveTaskColor(t, theme.barPalette) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{t.name || "Sans titre"}</span>
                </label>
              );
            })}
          </div>
        )}
      </Field>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onDuplicate}
          className="flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors"
          style={{ borderColor: c.gridLine, color: c.text }}
        >
          Dupliquer
        </button>
        <button
          onClick={onRemove}
          className="flex-1 rounded-lg border py-1.5 text-xs font-semibold text-red-500 transition-colors"
          style={{ borderColor: c.gridLine }}
        >
          Supprimer
        </button>
      </div>
    </aside>
  );
}

function Field({
  label,
  theme,
  children,
}: {
  label: string;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div
        className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: theme.colors.textMuted }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

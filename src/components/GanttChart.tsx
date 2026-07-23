import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { resolveTaskColor } from "../core/color";
import { ROW_HEIGHT } from "../core/config";
import { addDaysISO, daysBetween, spanDays } from "../core/dates";
import { durationLabel, shortDate } from "../core/format";
import type { LayoutResult } from "../core/layout";
import { isMilestone, taskProgress, type Task } from "../core/types";
import type { Theme } from "../themes/types";
import { GanttBar, type DragMode } from "./GanttBar";
import { withAlpha } from "./util";

interface GanttChartProps {
  tasks: Task[];
  layout: LayoutResult;
  theme: Theme;
  pxPerDay: number;
  selectedId: string | null;
  /** Horizontal scroll window, used to cull off-screen grid lines. */
  viewport: { left: number; width: number };
  onSelect: (id: string | null) => void;
  onMoveBar: (id: string, deltaDays: number) => void;
  onResizeStart: (id: string, newStart: string) => void;
  onResizeEnd: (id: string, newEnd: string) => void;
}

interface DragState {
  taskId: string;
  mode: DragMode;
  startClientX: number;
  originStart: string;
  originEnd: string;
}

interface Preview {
  taskId: string;
  start: string;
  end: string;
}

/** Extra px rendered either side of the viewport so scrolling stays smooth. */
const CULL_MARGIN = 400;

export function GanttChart({
  tasks,
  layout,
  theme,
  pxPerDay,
  selectedId,
  viewport,
  onSelect,
  onMoveBar,
  onResizeStart,
  onResizeEnd,
}: GanttChartProps) {
  const c = theme.colors;
  const { bars, links, ticks, weekendBands, todayX, totalWidth, totalHeight, rangeStart } = layout;

  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const svgHeight = Math.max(totalHeight, measuredHeight);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setMeasuredHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only the visible slice of the (potentially very wide) grid is rendered.
  const visible = useMemo(() => {
    const min = viewport.left - CULL_MARGIN;
    const max = viewport.left + viewport.width + CULL_MARGIN;
    return {
      ticks: ticks.filter((t) => t.x >= min && t.x <= max),
      bands: weekendBands.filter((b) => b.x + b.width >= min && b.x <= max),
    };
  }, [ticks, weekendBands, viewport.left, viewport.width]);

  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [active, setActive] = useState(false);

  const beginDrag = useCallback(
    (e: ReactPointerEvent, taskId: string, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      onSelect(taskId);
      dragRef.current = {
        taskId,
        mode,
        startClientX: e.clientX,
        originStart: task.start,
        originEnd: task.end,
      };
      const p = { taskId, start: task.start, end: task.end };
      previewRef.current = p;
      setPreview(p);
      setActive(true);
    },
    [tasks, onSelect],
  );

  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaDays = Math.round((e.clientX - d.startClientX) / pxPerDay);
      let start = d.originStart;
      let end = d.originEnd;
      if (d.mode === "move") {
        start = addDaysISO(d.originStart, deltaDays);
        end = addDaysISO(d.originEnd, deltaDays);
      } else if (d.mode === "resize-start") {
        start = addDaysISO(d.originStart, deltaDays);
        if (daysBetween(start, end) < 0) start = end;
      } else {
        end = addDaysISO(d.originEnd, deltaDays);
        if (daysBetween(start, end) < 0) end = start;
      }
      const p = { taskId: d.taskId, start, end };
      previewRef.current = p;
      setPreview(p);
    };
    const onUp = () => {
      const d = dragRef.current;
      const p = previewRef.current;
      if (d && p) {
        if (d.mode === "move") {
          onMoveBar(d.taskId, daysBetween(d.originStart, p.start));
        } else if (d.mode === "resize-start") {
          onResizeStart(d.taskId, p.start);
        } else {
          onResizeEnd(d.taskId, p.end);
        }
      }
      dragRef.current = null;
      previewRef.current = null;
      setPreview(null);
      setActive(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [active, pxPerDay, onMoveBar, onResizeStart, onResizeEnd]);

  /**
   * Keyboard editing on a focused bar:
   *   arrows        move by a day (shift: a week)
   *   alt+arrows    stretch / shrink the end date
   */
  const handleBarKey = useCallback(
    (e: ReactKeyboardEvent, task: Task) => {
      const step = e.shiftKey ? 7 : 1;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const delta = e.key === "ArrowLeft" ? -step : step;
      if (e.altKey && !isMilestone(task)) {
        onResizeEnd(task.id, addDaysISO(task.end, delta));
      } else {
        onMoveBar(task.id, delta);
      }
    },
    [onMoveBar, onResizeEnd],
  );

  if (tasks.length === 0) {
    return <div ref={containerRef} className="h-full w-full" style={{ background: c.surface }} />;
  }

  const tooltipBar =
    preview &&
    (() => {
      const x = daysBetween(rangeStart, preview.start) * pxPerDay;
      const width = spanDays(preview.start, preview.end) * pxPerDay;
      const bar = bars.find((b) => b.taskId === preview.taskId);
      return { x, width, y: bar ? bar.y : 0 };
    })();

  return (
    <div
      ref={containerRef}
      className="min-h-full w-full"
      style={{ background: c.surface, width: totalWidth }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <svg
        width={totalWidth}
        height={svgHeight}
        className="block"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        <defs>
          <marker
            id="dep-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 z" fill={c.link} />
          </marker>
        </defs>

        {/* Weekend bands (day view). */}
        {theme.weekendShade &&
          visible.bands.map((band, i) => (
            <rect
              key={`wk-${band.x}-${i}`}
              x={band.x}
              y={0}
              width={band.width}
              height={svgHeight}
              fill={c.weekendBand}
            />
          ))}

        {/* Zebra rows. */}
        {theme.zebra &&
          tasks.map((t, i) =>
            i % 2 === 1 ? (
              <rect
                key={`zebra-${t.id}`}
                x={0}
                y={i * ROW_HEIGHT}
                width={totalWidth}
                height={ROW_HEIGHT}
                fill={c.zebra}
              />
            ) : null,
          )}

        {/* Selection row highlight — accent, not the today color. */}
        {tasks.map((t, i) =>
          t.id === selectedId ? (
            <rect
              key={`sel-${t.id}`}
              x={0}
              y={i * ROW_HEIGHT}
              width={totalWidth}
              height={ROW_HEIGHT}
              fill={withAlpha(c.accent, 0.08)}
            />
          ) : null,
        )}

        {/* Vertical grid lines. */}
        {visible.ticks.map((tick) => (
          <line
            key={`grid-${tick.date}`}
            x1={tick.x}
            y1={0}
            x2={tick.x}
            y2={svgHeight}
            stroke={tick.major ? c.gridLineStrong : c.gridLine}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
        ))}

        {/* Today marker. */}
        {todayX !== null && (
          <g>
            <line x1={todayX} y1={0} x2={todayX} y2={svgHeight} stroke={c.todayMarker} strokeWidth={2} />
            <circle cx={todayX} cy={6} r={4} fill={c.todayMarker} />
          </g>
        )}

        {/* Dependency arrows, under the bars. */}
        <g style={{ pointerEvents: "none" }}>
          {links.map((link) => (
            <polyline
              key={`${link.fromId}->${link.toId}`}
              points={link.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={c.link}
              strokeWidth={1.5}
              strokeLinejoin="round"
              markerEnd="url(#dep-arrow)"
            />
          ))}
        </g>

        {/* Bars. */}
        {bars.map((bar, i) => {
          const task = tasks[i];
          const isPreviewing = preview?.taskId === task.id;
          const rendered = isPreviewing
            ? {
                ...bar,
                x: daysBetween(rangeStart, preview.start) * pxPerDay,
                width: bar.milestone
                  ? bar.width
                  : spanDays(preview.start, preview.end) * pxPerDay,
                progressWidth: bar.milestone
                  ? 0
                  : spanDays(preview.start, preview.end) * pxPerDay * taskProgress(task),
              }
            : bar;
          return (
            <GanttBar
              key={task.id}
              bar={rendered}
              name={task.name}
              fill={resolveTaskColor(task, theme.barPalette)}
              theme={theme}
              selected={task.id === selectedId}
              dragging={isPreviewing}
              ariaLabel={describeTask(task)}
              onSelect={() => onSelect(task.id)}
              onKeyDown={(e) => handleBarKey(e, task)}
              onPointerDown={(e, mode) => beginDrag(e, task.id, mode)}
            />
          );
        })}

        {/* Drag tooltip. */}
        {preview && tooltipBar && (
          <DragTooltip
            x={tooltipBar.x}
            width={tooltipBar.width}
            y={tooltipBar.y}
            label={`${shortDate(preview.start)} → ${shortDate(preview.end)} · ${durationLabel(
              preview.start,
              preview.end,
            )}`}
            theme={theme}
          />
        )}
      </svg>
    </div>
  );
}

/** Screen-reader / tooltip description of a task. */
function describeTask(task: Task): string {
  const name = task.name.trim() || "Sans titre";
  if (isMilestone(task)) return `Jalon « ${name} », ${shortDate(task.start)}`;
  const progress = taskProgress(task);
  const pct = progress > 0 ? `, ${Math.round(progress * 100)} % terminé` : "";
  return `Tâche « ${name} », du ${shortDate(task.start)} au ${shortDate(task.end)}, ${durationLabel(
    task.start,
    task.end,
  )}${pct}`;
}

function DragTooltip({
  x,
  width,
  y,
  label,
  theme,
}: {
  x: number;
  width: number;
  y: number;
  label: string;
  theme: Theme;
}) {
  const cx = x + width / 2;
  const boxW = Math.max(96, label.length * 6.6 + 16);
  const boxH = 24;
  const boxY = y - boxH - 8;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={cx - boxW / 2} y={boxY} width={boxW} height={boxH} rx={6} fill={theme.colors.text} opacity={0.92} />
      <text
        x={cx}
        y={boxY + boxH / 2}
        fill={theme.colors.surface}
        fontSize={11.5}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}

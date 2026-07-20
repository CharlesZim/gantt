import { format } from "date-fns";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ROW_HEIGHT } from "../core/config";
import { addDaysISO, daysBetween, parseISO, spanDays } from "../core/dates";
import type { LayoutResult } from "../core/layout";
import type { Task } from "../core/types";
import type { Theme } from "../themes/types";
import { GanttBar, type DragMode } from "./GanttBar";

interface GanttChartProps {
  tasks: Task[];
  layout: LayoutResult;
  theme: Theme;
  pxPerDay: number;
  selectedId: string | null;
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

function fmt(iso: string): string {
  return format(parseISO(iso), "d MMM");
}

export function GanttChart({
  tasks,
  layout,
  theme,
  pxPerDay,
  selectedId,
  onSelect,
  onMoveBar,
  onResizeStart,
  onResizeEnd,
}: GanttChartProps) {
  const c = theme.colors;
  const { bars, ticks, weekendBands, todayX, totalWidth, totalHeight, rangeStart } = layout;

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
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [active, pxPerDay, onMoveBar, onResizeStart, onResizeEnd]);

  // Empty state.
  if (tasks.length === 0) {
    return (
      <div ref={containerRef} className="h-full w-full" style={{ background: c.surface }} />
    );
  }

  const tooltipBar =
    preview &&
    (() => {
      const x = daysBetween(rangeStart, preview.start) * pxPerDay;
      const width = spanDays(preview.start, preview.end) * pxPerDay;
      const bar = bars.find((b) => b.taskId === preview.taskId);
      const y = bar ? bar.y : 0;
      return { x, width, y };
    })();

  return (
    <div
      ref={containerRef}
      className="min-h-full w-full"
      style={{ background: c.surface, width: totalWidth }}
      onPointerDown={(e) => {
        // Click on empty chart background clears selection.
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <svg
        width={totalWidth}
        height={svgHeight}
        className="block"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        {/* Weekend bands (day view). */}
        {theme.weekendShade &&
          weekendBands.map((band, i) => (
            <rect
              key={`wk-${i}`}
              x={band.x}
              y={0}
              width={band.width}
              height={svgHeight}
              fill={c.weekendBand}
            />
          ))}

        {/* Zebra rows. */}
        {theme.zebra &&
          tasks.map((_, i) =>
            i % 2 === 1 ? (
              <rect
                key={`zebra-${i}`}
                x={0}
                y={i * ROW_HEIGHT}
                width={totalWidth}
                height={ROW_HEIGHT}
                fill={c.zebra}
              />
            ) : null,
          )}

        {/* Selection row highlight. */}
        {tasks.map((t, i) =>
          t.id === selectedId ? (
            <rect
              key={`sel-${i}`}
              x={0}
              y={i * ROW_HEIGHT}
              width={totalWidth}
              height={ROW_HEIGHT}
              fill={c.todayMarker}
              opacity={0.06}
            />
          ) : null,
        )}

        {/* Vertical grid lines. */}
        {ticks.map((tick, i) => (
          <line
            key={`grid-${i}`}
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
            <line
              x1={todayX}
              y1={0}
              x2={todayX}
              y2={svgHeight}
              stroke={c.todayMarker}
              strokeWidth={2}
            />
            <circle cx={todayX} cy={6} r={4} fill={c.todayMarker} />
          </g>
        )}

        {/* Bars. */}
        {bars.map((bar, i) => {
          const task = tasks[i];
          const isPreviewing = preview?.taskId === task.id;
          const rendered = isPreviewing
            ? {
                ...bar,
                x: daysBetween(rangeStart, preview.start) * pxPerDay,
                width: spanDays(preview.start, preview.end) * pxPerDay,
              }
            : bar;
          return (
            <GanttBar
              key={task.id}
              bar={rendered}
              name={task.name}
              fill={theme.barPalette[task.colorKey % theme.barPalette.length]}
              stroke={c.barStroke}
              radius={theme.barRadius}
              selected={task.id === selectedId}
              dragging={isPreviewing}
              onSelect={() => onSelect(task.id)}
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
            label={`${fmt(preview.start)} → ${fmt(preview.end)} · ${spanDays(
              preview.start,
              preview.end,
            )} j`}
            theme={theme}
          />
        )}
      </svg>
    </div>
  );
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
  const left = cx - boxW / 2;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={left}
        y={boxY}
        width={boxW}
        height={boxH}
        rx={6}
        fill={theme.colors.text}
        opacity={0.92}
      />
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

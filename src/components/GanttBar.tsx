import type { PointerEvent as ReactPointerEvent } from "react";
import type { BarLayout } from "../core/layout";
import { readableTextColor } from "./util";

export type DragMode = "move" | "resize-start" | "resize-end";

interface GanttBarProps {
  bar: BarLayout;
  name: string;
  fill: string;
  stroke: string;
  radius: number;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent, mode: DragMode) => void;
  onSelect: () => void;
}

const HANDLE_W = 8;

export function GanttBar({
  bar,
  name,
  fill,
  stroke,
  radius,
  selected,
  dragging,
  onPointerDown,
  onSelect,
}: GanttBarProps) {
  const { x, y, width, height } = bar;
  const textColor = readableTextColor(fill);
  const showLabel = width > 46 && name.trim().length > 0;
  const r = Math.min(radius, height / 2);

  return (
    <g
      className="gantt-bar-group"
      onPointerDown={onSelect}
      style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
    >
      {selected && (
        <rect
          x={x - 2.5}
          y={y - 2.5}
          width={width + 5}
          height={height + 5}
          rx={r + 2.5}
          fill="none"
          stroke="var(--today)"
          strokeWidth={2}
          opacity={0.9}
        />
      )}
      <rect
        className="gantt-bar-rect"
        x={x}
        y={y}
        width={width}
        height={height}
        rx={r}
        fill={fill}
        stroke={stroke === "none" ? undefined : stroke}
        strokeWidth={stroke === "none" ? undefined : 1}
        opacity={dragging ? 0.92 : 1}
        style={{
          filter: dragging
            ? "drop-shadow(0 6px 14px rgba(0,0,0,0.28))"
            : "drop-shadow(0 1px 2px rgba(0,0,0,0.14))",
        }}
        onPointerDown={(e) => onPointerDown(e, "move")}
      />
      {showLabel && (
        <text
          x={x + 10}
          y={y + height / 2}
          fill={textColor}
          fontSize={12.5}
          fontWeight={600}
          dominantBaseline="central"
          style={{ pointerEvents: "none", userSelect: "none" }}
          clipPath={`inset(0 0 0 0)`}
        >
          <tspan>{truncate(name, width)}</tspan>
        </text>
      )}

      {/* Resize handles — appear on hover. */}
      <rect
        className="gantt-handle"
        x={x - HANDLE_W / 2}
        y={y}
        width={HANDLE_W}
        height={height}
        rx={3}
        fill={textColor}
        fillOpacity={0.001}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={0}
        style={{ cursor: "ew-resize" }}
        onPointerDown={(e) => onPointerDown(e, "resize-start")}
      />
      <rect
        className="gantt-handle"
        x={x + width - HANDLE_W / 2}
        y={y}
        width={HANDLE_W}
        height={height}
        rx={3}
        fill={textColor}
        fillOpacity={0.001}
        style={{ cursor: "ew-resize" }}
        onPointerDown={(e) => onPointerDown(e, "resize-end")}
      />
      {/* Visible grip pips inside the hover handles. */}
      <g className="gantt-handle" style={{ pointerEvents: "none" }}>
        <rect x={x + 2.5} y={y + height / 2 - 5} width={2} height={10} rx={1} fill={textColor} opacity={0.7} />
        <rect
          x={x + width - 4.5}
          y={y + height / 2 - 5}
          width={2}
          height={10}
          rx={1}
          fill={textColor}
          opacity={0.7}
        />
      </g>
    </g>
  );
}

/** Rough character budget so labels never obviously overflow the bar. */
function truncate(name: string, width: number): string {
  const maxChars = Math.max(0, Math.floor((width - 18) / 7));
  if (name.length <= maxChars) return name;
  if (maxChars <= 1) return "";
  return name.slice(0, maxChars - 1).trimEnd() + "…";
}

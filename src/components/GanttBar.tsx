import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { MILESTONE_R, MIN_INSIDE_LABEL_WIDTH } from "../core/config";
import type { BarLayout } from "../core/layout";
import { fontShorthand, truncateToWidth } from "../render/text";
import type { Theme } from "../themes/types";
import { readableTextColor } from "./util";

export type DragMode = "move" | "resize-start" | "resize-end";

interface GanttBarProps {
  bar: BarLayout;
  name: string;
  fill: string;
  theme: Theme;
  selected: boolean;
  dragging: boolean;
  /** Announced on focus; also the hover title. */
  ariaLabel: string;
  onPointerDown: (e: ReactPointerEvent, mode: DragMode) => void;
  onSelect: () => void;
  onKeyDown: (e: ReactKeyboardEvent) => void;
}

const HANDLE_W = 8;
const LABEL_SIZE = 12.5;
const LABEL_PAD = 10;
/** Height of the progress rail drawn along the bottom of a bar. */
const RAIL_H = 5;

export function GanttBar({
  bar,
  name,
  fill,
  theme,
  selected,
  dragging,
  ariaLabel,
  onPointerDown,
  onSelect,
  onKeyDown,
}: GanttBarProps) {
  const { x, y, width, height, cy, milestone, progressWidth } = bar;
  const c = theme.colors;
  const trimmed = name.trim();

  const shell = (children: ReactNode) => (
    <g
      className="gantt-bar-group"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onPointerDown={onSelect}
      onKeyDown={onKeyDown}
      onFocus={onSelect}
      style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
    >
      <title>{ariaLabel}</title>
      {children}
    </g>
  );

  // ---- Milestone: a diamond centred on its day, name to the right ----
  if (milestone) {
    const cx = x + width / 2;
    const r = MILESTONE_R;
    const diamond = (radius: number) =>
      `${cx},${cy - radius} ${cx + radius},${cy} ${cx},${cy + radius} ${cx - radius},${cy}`;
    return shell(
      <>
        {selected && (
          <polygon points={diamond(r + 4)} fill="none" stroke={c.accent} strokeWidth={2} />
        )}
        <polygon
          className="gantt-bar-rect"
          points={diamond(r)}
          fill={fill}
          stroke={c.surface}
          strokeWidth={1.5}
          opacity={dragging ? 0.92 : 1}
          style={{
            filter: dragging
              ? "drop-shadow(0 6px 14px rgba(0,0,0,0.28))"
              : "drop-shadow(0 1px 2px rgba(0,0,0,0.14))",
          }}
          onPointerDown={(e) => onPointerDown(e, "move")}
        />
        {trimmed && (
          <text
            x={cx + r + 6}
            y={cy}
            fill={c.text}
            fontSize={LABEL_SIZE}
            fontWeight={600}
            dominantBaseline="central"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {trimmed}
          </text>
        )}
      </>,
    );
  }

  // ---- Task bar ----
  const r = Math.min(theme.barRadius, height / 2);
  const textColor = readableTextColor(fill);
  const labelFont = fontShorthand(600, LABEL_SIZE, theme.fontFamily);
  const insideWidth = width - LABEL_PAD * 2;
  const fitsInside = width >= MIN_INSIDE_LABEL_WIDTH && insideWidth > 0;
  // Bars too narrow to hold their name still get one — just outside, in body ink.
  const insideLabel = fitsInside && trimmed ? truncateToWidth(trimmed, insideWidth, labelFont) : "";
  const outsideLabel = !insideLabel && trimmed ? trimmed : "";
  const clipId = `bar-clip-${bar.taskId}`;

  return shell(
    <>
      {selected && (
        <rect
          x={x - 2.5}
          y={y - 2.5}
          width={width + 5}
          height={height + 5}
          rx={r + 2.5}
          fill="none"
          stroke={c.accent}
          strokeWidth={2}
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
        stroke={c.barStroke === "none" ? undefined : c.barStroke}
        strokeWidth={c.barStroke === "none" ? undefined : 1}
        opacity={dragging ? 0.92 : 1}
        style={{
          filter: dragging
            ? "drop-shadow(0 6px 14px rgba(0,0,0,0.28))"
            : "drop-shadow(0 1px 2px rgba(0,0,0,0.14))",
        }}
        onPointerDown={(e) => onPointerDown(e, "move")}
      />

      {/*
        Progress rail. Drawn as an inset track along the bottom of the bar
        rather than by tinting the bar itself, so the label keeps a single,
        always-legible ink color whatever the completion ratio.
      */}
      {progressWidth > 0 && (
        <g style={{ pointerEvents: "none" }}>
          <clipPath id={clipId}>
            <rect x={x} y={y} width={width} height={height} rx={r} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <rect
              x={x}
              y={y + height - RAIL_H - 3}
              width={width}
              height={RAIL_H}
              rx={RAIL_H / 2}
              fill={textColor}
              opacity={0.22}
            />
            <rect
              x={x}
              y={y + height - RAIL_H - 3}
              width={progressWidth}
              height={RAIL_H}
              rx={RAIL_H / 2}
              fill={textColor}
              opacity={0.85}
            />
          </g>
        </g>
      )}

      {insideLabel && (
        <text
          x={x + LABEL_PAD}
          y={y + height / 2 - (progressWidth > 0 ? 3 : 0)}
          fill={textColor}
          fontSize={LABEL_SIZE}
          fontWeight={600}
          dominantBaseline="central"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {insideLabel}
        </text>
      )}
      {outsideLabel && (
        <text
          x={x + width + 6}
          y={y + height / 2}
          fill={c.text}
          fontSize={LABEL_SIZE}
          fontWeight={600}
          dominantBaseline="central"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {outsideLabel}
        </text>
      )}

      {/* Resize handles — appear on hover / keyboard focus. */}
      <rect
        className="gantt-handle"
        x={x - HANDLE_W / 2}
        y={y}
        width={HANDLE_W}
        height={height}
        rx={3}
        fill={textColor}
        fillOpacity={0.001}
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
    </>,
  );
}

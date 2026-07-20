import { AXIS_BOTTOM_HEIGHT, AXIS_HEIGHT, AXIS_TOP_HEIGHT } from "../core/config";
import type { AxisSegment, AxisTick } from "../core/layout";
import type { TimeUnit } from "../core/types";
import type { Theme } from "../themes/types";

interface TimeAxisProps {
  axisTop: AxisSegment[];
  ticks: AxisTick[];
  totalWidth: number;
  unit: TimeUnit;
  pxPerDay: number;
  theme: Theme;
}

export function TimeAxis({ axisTop, ticks, totalWidth, unit, pxPerDay, theme }: TimeAxisProps) {
  const c = theme.colors;

  return (
    <svg
      width={totalWidth}
      height={AXIS_HEIGHT}
      className="block select-none"
      style={{ background: c.surface }}
      aria-hidden
    >
      {/* Top band background + divider */}
      <line
        x1={0}
        y1={AXIS_TOP_HEIGHT}
        x2={totalWidth}
        y2={AXIS_TOP_HEIGHT}
        stroke={c.gridLine}
        strokeWidth={1}
      />

      {/* Top-level segments (months, or years in month view) */}
      {axisTop.map((seg, i) => (
        <g key={`top-${i}`}>
          {i > 0 && (
            <line
              x1={seg.x}
              y1={0}
              x2={seg.x}
              y2={AXIS_TOP_HEIGHT}
              stroke={c.gridLineStrong}
              strokeWidth={1}
            />
          )}
          <text
            x={seg.x + 10}
            y={AXIS_TOP_HEIGHT / 2}
            fill={c.text}
            fontSize={12}
            fontWeight={700}
            dominantBaseline="central"
            style={{ letterSpacing: "0.02em" }}
          >
            {seg.label}
          </text>
        </g>
      ))}

      {/* Bottom-level ticks (days / weeks / months) */}
      {ticks.map((tick, i) => {
        const center = unit === "day" ? tick.x + pxPerDay / 2 : tick.x + 6;
        const anchor = unit === "day" ? "middle" : "start";
        return (
          <g key={`tick-${i}`}>
            {tick.major && (
              <line
                x1={tick.x}
                y1={AXIS_TOP_HEIGHT}
                x2={tick.x}
                y2={AXIS_HEIGHT}
                stroke={c.gridLineStrong}
                strokeWidth={1}
              />
            )}
            <text
              x={center}
              y={AXIS_TOP_HEIGHT + AXIS_BOTTOM_HEIGHT / 2}
              fill={tick.major ? c.text : c.textMuted}
              fontSize={11}
              fontWeight={tick.major ? 600 : 400}
              textAnchor={anchor}
              dominantBaseline="central"
            >
              {tick.label}
            </text>
          </g>
        );
      })}

      {/* Bottom divider */}
      <line
        x1={0}
        y1={AXIS_HEIGHT - 0.5}
        x2={totalWidth}
        y2={AXIS_HEIGHT - 0.5}
        stroke={c.gridLineStrong}
        strokeWidth={1}
      />
    </svg>
  );
}

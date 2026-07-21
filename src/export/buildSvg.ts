// Single source of truth for exports: build a standalone, themed SVG string.
// Every export format (SVG / PNG / PDF) derives from this, so exports always
// match what the user sees on screen.
import { format } from "date-fns";
import {
  AXIS_BOTTOM_HEIGHT,
  AXIS_HEIGHT,
  AXIS_TOP_HEIGHT,
  BAR_HEIGHT,
  PAD_DAYS,
  ROW_HEIGHT,
} from "../core/config";
import { resolveTaskColor } from "../core/color";
import { parseISO } from "../core/dates";
import { computeLayout, pxPerDayForUnit } from "../core/layout";
import type { GanttState } from "../core/types";
import type { Theme } from "../themes/types";
import { readableTextColor } from "../components/util";

export interface BuildSvgOptions {
  showTitle?: boolean;
  padding?: number;
  labelWidth?: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateLabel(name: string, width: number, charPx = 7): string {
  const max = Math.max(0, Math.floor((width - 14) / charPx));
  if (name.length <= max) return name;
  if (max <= 1) return "";
  return name.slice(0, max - 1).trimEnd() + "…";
}

export function buildSvg(state: GanttState, theme: Theme, options: BuildSvgOptions = {}): string {
  const P = options.padding ?? 28;
  const LABEL_W = options.labelWidth ?? 200;
  const showTitle = options.showTitle ?? true;
  const c = theme.colors;
  const pxPerDay = pxPerDayForUnit(state.unit);

  const ordered = [...state.tasks].sort((a, b) => a.order - b.order);
  const layout = computeLayout({
    tasks: ordered,
    unit: state.unit,
    rowHeight: ROW_HEIGHT,
    barHeight: BAR_HEIGHT,
    pxPerDay,
    padDays: PAD_DAYS,
  });

  const rowsHeight = Math.max(layout.totalHeight, ROW_HEIGHT);
  const titleH = showTitle ? 42 : 0;
  const chartX = P + LABEL_W;
  const axisY = P + titleH;
  const chartY = axisY + AXIS_HEIGHT;
  const svgW = P * 2 + LABEL_W + layout.totalWidth;
  const svgH = chartY + rowsHeight + P;

  const parts: string[] = [];

  // Background + surface panel.
  parts.push(`<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="${c.background}"/>`);
  parts.push(
    `<rect x="${P}" y="${axisY}" width="${LABEL_W + layout.totalWidth}" height="${AXIS_HEIGHT + rowsHeight}" fill="${c.surface}" rx="10"/>`,
  );

  // Title.
  if (showTitle) {
    parts.push(
      `<text x="${P}" y="${P + 20}" fill="${c.text}" font-size="22" font-weight="700">${esc(state.title || "Gantt")}</text>`,
    );
  }

  // ---- Chart decorations (translated to chart origin) ----
  const chart: string[] = [];
  // Weekend bands.
  if (theme.weekendShade) {
    for (const band of layout.weekendBands) {
      chart.push(
        `<rect x="${band.x}" y="0" width="${band.width}" height="${rowsHeight}" fill="${c.weekendBand}"/>`,
      );
    }
  }
  // Zebra rows.
  if (theme.zebra) {
    ordered.forEach((_, i) => {
      if (i % 2 === 1) {
        chart.push(
          `<rect x="0" y="${i * ROW_HEIGHT}" width="${layout.totalWidth}" height="${ROW_HEIGHT}" fill="${c.zebra}"/>`,
        );
      }
    });
  }
  // Vertical grid lines.
  for (const tick of layout.ticks) {
    chart.push(
      `<line x1="${tick.x}" y1="0" x2="${tick.x}" y2="${rowsHeight}" stroke="${tick.major ? c.gridLineStrong : c.gridLine}" stroke-width="1"/>`,
    );
  }
  // Today marker.
  if (layout.todayX !== null) {
    chart.push(
      `<line x1="${layout.todayX}" y1="0" x2="${layout.todayX}" y2="${rowsHeight}" stroke="${c.todayMarker}" stroke-width="2"/>`,
    );
    chart.push(`<circle cx="${layout.todayX}" cy="6" r="4" fill="${c.todayMarker}"/>`);
  }
  // Bars.
  layout.bars.forEach((bar, i) => {
    const task = ordered[i];
    const fill = resolveTaskColor(task, theme.barPalette);
    const r = Math.min(theme.barRadius, bar.height / 2);
    const strokeAttr =
      c.barStroke === "none" ? "" : ` stroke="${c.barStroke}" stroke-width="1"`;
    chart.push(
      `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${r}" fill="${fill}"${strokeAttr}/>`,
    );
    if (bar.width > 46 && task.name.trim()) {
      const tc = readableTextColor(fill);
      chart.push(
        `<text x="${bar.x + 10}" y="${bar.y + bar.height / 2}" fill="${tc}" font-size="12.5" font-weight="600" dominant-baseline="central">${esc(truncateLabel(task.name, bar.width))}</text>`,
      );
    }
  });
  parts.push(`<g transform="translate(${chartX},${chartY})">${chart.join("")}</g>`);

  // ---- Axis (translated to axis origin) ----
  const axis: string[] = [];
  axis.push(
    `<line x1="0" y1="${AXIS_TOP_HEIGHT}" x2="${layout.totalWidth}" y2="${AXIS_TOP_HEIGHT}" stroke="${c.gridLine}"/>`,
  );
  layout.axisTop.forEach((seg, i) => {
    if (i > 0) {
      axis.push(
        `<line x1="${seg.x}" y1="0" x2="${seg.x}" y2="${AXIS_TOP_HEIGHT}" stroke="${c.gridLineStrong}"/>`,
      );
    }
    axis.push(
      `<text x="${seg.x + 10}" y="${AXIS_TOP_HEIGHT / 2}" fill="${c.text}" font-size="12" font-weight="700" dominant-baseline="central">${esc(seg.label)}</text>`,
    );
  });
  for (const tick of layout.ticks) {
    const center = state.unit === "day" ? tick.x + pxPerDay / 2 : tick.x + 6;
    const anchor = state.unit === "day" ? "middle" : "start";
    if (tick.major) {
      axis.push(
        `<line x1="${tick.x}" y1="${AXIS_TOP_HEIGHT}" x2="${tick.x}" y2="${AXIS_HEIGHT}" stroke="${c.gridLineStrong}"/>`,
      );
    }
    axis.push(
      `<text x="${center}" y="${AXIS_TOP_HEIGHT + AXIS_BOTTOM_HEIGHT / 2}" fill="${tick.major ? c.text : c.textMuted}" font-size="11" font-weight="${tick.major ? 600 : 400}" text-anchor="${anchor}" dominant-baseline="central">${esc(tick.label)}</text>`,
    );
  }
  axis.push(
    `<line x1="0" y1="${AXIS_HEIGHT}" x2="${layout.totalWidth}" y2="${AXIS_HEIGHT}" stroke="${c.gridLineStrong}"/>`,
  );
  parts.push(`<g transform="translate(${chartX},${axisY})">${axis.join("")}</g>`);

  // ---- Left task-name column ----
  const labels: string[] = [];
  labels.push(
    `<text x="0" y="${AXIS_HEIGHT / 2}" fill="${c.textMuted}" font-size="11" font-weight="600" letter-spacing="0.06em" dominant-baseline="central">TÂCHES</text>`,
  );
  ordered.forEach((task, i) => {
    const y = AXIS_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;
    const fill = resolveTaskColor(task, theme.barPalette);
    labels.push(`<circle cx="5" cy="${y}" r="4" fill="${fill}"/>`);
    labels.push(
      `<text x="16" y="${y - 6}" fill="${c.text}" font-size="13" font-weight="600" dominant-baseline="central">${esc(truncateLabel(task.name || "Sans titre", LABEL_W - 16, 7.2))}</text>`,
    );
    labels.push(
      `<text x="16" y="${y + 9}" fill="${c.textMuted}" font-size="10.5" dominant-baseline="central">${esc(dateRange(task.start, task.end))}</text>`,
    );
  });
  parts.push(`<g transform="translate(${P},${axisY})">${labels.join("")}</g>`);

  // Column separator.
  parts.push(
    `<line x1="${chartX}" y1="${axisY}" x2="${chartX}" y2="${chartY + rowsHeight}" stroke="${c.gridLineStrong}"/>`,
  );

  const fontFamily = theme.fontFamily.replace(/"/g, "'");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" font-family="${esc(fontFamily)}"><style>text{font-family:${esc(fontFamily)};}</style>${parts.join("")}</svg>`;
}

function dateRange(start: string, end: string): string {
  return `${format(parseISO(start), "d MMM")} – ${format(parseISO(end), "d MMM yyyy")}`;
}

/** Dimensions of the SVG produced by buildSvg, without re-serializing. */
export function svgDimensions(state: GanttState, options: BuildSvgOptions = {}): {
  width: number;
  height: number;
} {
  const P = options.padding ?? 28;
  const LABEL_W = options.labelWidth ?? 200;
  const showTitle = options.showTitle ?? true;
  const pxPerDay = pxPerDayForUnit(state.unit);
  const ordered = [...state.tasks].sort((a, b) => a.order - b.order);
  const layout = computeLayout({
    tasks: ordered,
    unit: state.unit,
    rowHeight: ROW_HEIGHT,
    barHeight: BAR_HEIGHT,
    pxPerDay,
    padDays: PAD_DAYS,
  });
  const rowsHeight = Math.max(layout.totalHeight, ROW_HEIGHT);
  const titleH = showTitle ? 42 : 0;
  return {
    width: P * 2 + LABEL_W + layout.totalWidth,
    height: P + titleH + AXIS_HEIGHT + rowsHeight + P,
  };
}

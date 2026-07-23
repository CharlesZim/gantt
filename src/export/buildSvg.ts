// Single source of truth for exports: build a standalone, themed SVG string.
// Every export format (SVG / PNG / PDF) derives from this, so exports always
// match what the user sees on screen.
import { resolveTaskColor } from "../core/color";
import {
  AXIS_BOTTOM_HEIGHT,
  AXIS_HEIGHT,
  AXIS_TOP_HEIGHT,
  BAR_HEIGHT,
  MILESTONE_R,
  MIN_INSIDE_LABEL_WIDTH,
  PAD_DAYS,
  ROW_HEIGHT,
} from "../core/config";
import { spanDays } from "../core/dates";
import { dateRangeLabel, formatISO, shortDate } from "../core/format";
import { computeLayout, pxPerDayForUnit, type LayoutResult } from "../core/layout";
import { isMilestone, taskProgress, type GanttState, type Task } from "../core/types";
import { fontShorthand, truncateToWidth } from "../render/text";
import type { Theme } from "../themes/types";
import { readableTextColor } from "../components/util";
import { fontCssForTheme } from "./fonts";

export interface BuildSvgOptions {
  showTitle?: boolean;
  /** Date range + task count under the title. */
  showSubtitle?: boolean;
  /** Color legend listing every task, below the chart. */
  showLegend?: boolean;
  /** "Généré le …" line in the bottom-left. */
  showFooter?: boolean;
  /** Omit the page background rect, for a PNG with an alpha channel. */
  transparent?: boolean;
  padding?: number;
  labelWidth?: number;
  /** Fixed today for deterministic output (tests / snapshots). */
  today?: string;
}

const TITLE_H = 30;
const SUBTITLE_H = 20;
const FOOTER_H = 22;
const LEGEND_ROW_H = 20;
const LEGEND_COL_W = 190;
const LEGEND_TOP_GAP = 16;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Everything both `buildSvg` and `svgDimensions` need, computed once.
 * Keeping them on a single derivation is what stops the exported bitmap size
 * from drifting away from the SVG it is rasterising.
 */
interface Plan {
  ordered: Task[];
  layout: LayoutResult;
  pxPerDay: number;
  P: number;
  labelWidth: number;
  chartX: number;
  axisY: number;
  chartY: number;
  rowsHeight: number;
  panelW: number;
  legendRows: number;
  legendCols: number;
  legendY: number;
  legendH: number;
  width: number;
  height: number;
  opts: Required<Omit<BuildSvgOptions, "today">> & { today?: string };
}

function plan(state: GanttState, options: BuildSvgOptions): Plan {
  const opts = {
    showTitle: options.showTitle ?? true,
    showSubtitle: options.showSubtitle ?? true,
    showLegend: options.showLegend ?? false,
    showFooter: options.showFooter ?? true,
    transparent: options.transparent ?? false,
    padding: options.padding ?? 28,
    labelWidth: options.labelWidth ?? 200,
    today: options.today,
  };

  const P = opts.padding;
  const pxPerDay = pxPerDayForUnit(state.unit);
  const ordered = [...state.tasks].sort((a, b) => a.order - b.order);
  const layout = computeLayout({
    tasks: ordered,
    unit: state.unit,
    rowHeight: ROW_HEIGHT,
    barHeight: BAR_HEIGHT,
    pxPerDay,
    padDays: PAD_DAYS,
    today: opts.today,
  });

  const rowsHeight = Math.max(layout.totalHeight, ROW_HEIGHT);
  const headerH =
    (opts.showTitle ? TITLE_H : 0) + (opts.showTitle && opts.showSubtitle ? SUBTITLE_H : 0);
  const axisY = P + headerH;
  const chartX = P + opts.labelWidth;
  const chartY = axisY + AXIS_HEIGHT;
  const panelW = opts.labelWidth + layout.totalWidth;

  const legendCols = Math.max(1, Math.floor(panelW / LEGEND_COL_W));
  const legendRows = opts.showLegend ? Math.ceil(ordered.length / legendCols) : 0;
  const legendY = chartY + rowsHeight + LEGEND_TOP_GAP;
  const legendH = legendRows * LEGEND_ROW_H;

  const contentBottom = chartY + rowsHeight + (legendRows > 0 ? LEGEND_TOP_GAP + legendH : 0);

  return {
    ordered,
    layout,
    pxPerDay,
    P,
    labelWidth: opts.labelWidth,
    chartX,
    axisY,
    chartY,
    rowsHeight,
    panelW,
    legendRows,
    legendCols,
    legendY,
    legendH,
    width: P * 2 + panelW,
    height: contentBottom + (opts.showFooter ? FOOTER_H : 0) + P,
    opts,
  };
}

/** Dimensions of the SVG produced by `buildSvg` for the same options. */
export function svgDimensions(
  state: GanttState,
  options: BuildSvgOptions = {},
): { width: number; height: number } {
  const p = plan(state, options);
  return { width: p.width, height: p.height };
}

/**
 * Render the chart as an SVG string.
 *
 * `fontCss` is injected verbatim into the document <style>; pass the embedded
 * @font-face rules from `fontCssForTheme` for files that leave the app, and ""
 * for the in-app preview (which already has the webfont loaded).
 */
export function buildSvg(
  state: GanttState,
  theme: Theme,
  options: BuildSvgOptions = {},
  fontCss = "",
): string {
  const p = plan(state, options);
  const { ordered, layout, pxPerDay, P, chartX, axisY, chartY, rowsHeight, panelW } = p;
  const c = theme.colors;
  const family = theme.fontFamily;

  const parts: string[] = [];
  const panelClip = "panel-clip";

  // Background + rounded surface panel. Chart content is clipped to the panel
  // so grid lines and bars never spill past its rounded corners.
  if (!p.opts.transparent) {
    parts.push(`<rect x="0" y="0" width="${p.width}" height="${p.height}" fill="${c.background}"/>`);
  }
  parts.push(
    `<defs>` +
      `<clipPath id="${panelClip}"><rect x="${P}" y="${axisY}" width="${panelW}" height="${
        AXIS_HEIGHT + rowsHeight
      }" rx="10"/></clipPath>` +
      `<marker id="dep-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="${c.link}"/></marker>` +
      `</defs>`,
  );
  parts.push(
    `<rect x="${P}" y="${axisY}" width="${panelW}" height="${AXIS_HEIGHT + rowsHeight}" fill="${c.surface}" rx="10"/>`,
  );

  // ---- Title block ----
  if (p.opts.showTitle) {
    parts.push(
      `<text x="${P}" y="${P + 18}" fill="${c.text}" font-size="22" font-weight="700">${esc(
        state.title || "Gantt",
      )}</text>`,
    );
    if (p.opts.showSubtitle) {
      parts.push(
        `<text x="${P}" y="${P + TITLE_H + 8}" fill="${c.textMuted}" font-size="12">${esc(
          subtitle(state),
        )}</text>`,
      );
    }
  }

  // ---- Chart body (clipped to the panel) ----
  const chart: string[] = [];

  if (theme.weekendShade) {
    for (const band of layout.weekendBands) {
      chart.push(
        `<rect x="${band.x}" y="0" width="${band.width}" height="${rowsHeight}" fill="${c.weekendBand}"/>`,
      );
    }
  }
  if (theme.zebra) {
    ordered.forEach((_, i) => {
      if (i % 2 === 1) {
        chart.push(
          `<rect x="0" y="${i * ROW_HEIGHT}" width="${layout.totalWidth}" height="${ROW_HEIGHT}" fill="${c.zebra}"/>`,
        );
      }
    });
  }
  for (const tick of layout.ticks) {
    chart.push(
      `<line x1="${tick.x}" y1="0" x2="${tick.x}" y2="${rowsHeight}" stroke="${
        tick.major ? c.gridLineStrong : c.gridLine
      }" stroke-width="1"/>`,
    );
  }
  if (layout.todayX !== null) {
    chart.push(
      `<line x1="${layout.todayX}" y1="0" x2="${layout.todayX}" y2="${rowsHeight}" stroke="${c.todayMarker}" stroke-width="2"/>`,
    );
    chart.push(`<circle cx="${layout.todayX}" cy="6" r="4" fill="${c.todayMarker}"/>`);
  }

  // Dependency arrows sit under the bars.
  for (const link of layout.links) {
    chart.push(
      `<polyline points="${link.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}" fill="none" stroke="${
        c.link
      }" stroke-width="1.5" stroke-linejoin="round" marker-end="url(#dep-arrow)"/>`,
    );
  }

  const labelFont = fontShorthand(600, 12.5, family);
  layout.bars.forEach((bar, i) => {
    const task = ordered[i];
    const fill = resolveTaskColor(task, theme.barPalette);
    const name = task.name.trim();

    if (bar.milestone) {
      const cx = bar.x + bar.width / 2;
      const r = MILESTONE_R;
      chart.push(
        `<polygon points="${cx},${bar.cy - r} ${cx + r},${bar.cy} ${cx},${bar.cy + r} ${cx - r},${bar.cy}" fill="${fill}" stroke="${c.surface}" stroke-width="1.5"/>`,
      );
      if (name) {
        chart.push(
          `<text x="${cx + r + 6}" y="${bar.cy}" fill="${c.text}" font-size="12.5" font-weight="600" dominant-baseline="central">${esc(name)}</text>`,
        );
      }
      return;
    }

    const r = Math.min(theme.barRadius, bar.height / 2);
    const strokeAttr = c.barStroke === "none" ? "" : ` stroke="${c.barStroke}" stroke-width="1"`;
    chart.push(
      `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${r}" fill="${fill}"${strokeAttr}/>`,
    );

    // Progress rail along the bottom of the bar (matches the on-screen bar).
    if (bar.progressWidth > 0) {
      const ink = readableTextColor(fill);
      const railH = 5;
      const railY = bar.y + bar.height - railH - 3;
      const clipId = `bc-${i}`;
      chart.push(
        `<clipPath id="${clipId}"><rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${r}"/></clipPath>` +
          `<g clip-path="url(#${clipId})">` +
          `<rect x="${bar.x}" y="${railY}" width="${bar.width}" height="${railH}" rx="${railH / 2}" fill="${ink}" opacity="0.22"/>` +
          `<rect x="${bar.x}" y="${railY}" width="${bar.progressWidth}" height="${railH}" rx="${railH / 2}" fill="${ink}" opacity="0.85"/>` +
          `</g>`,
      );
    }

    if (!name) return;
    const pad = 10;
    const insideWidth = bar.width - pad * 2;
    const fitsInside = bar.width >= MIN_INSIDE_LABEL_WIDTH && insideWidth > 0;
    const inside = fitsInside ? truncateToWidth(name, insideWidth, labelFont) : "";
    const labelY = bar.y + bar.height / 2 - (bar.progressWidth > 0 ? 3 : 0);
    if (inside) {
      chart.push(
        `<text x="${bar.x + pad}" y="${labelY}" fill="${readableTextColor(fill)}" font-size="12.5" font-weight="600" dominant-baseline="central">${esc(inside)}</text>`,
      );
    } else {
      // Too narrow to hold the name — set it just outside, in body ink, so no
      // bar is ever left unlabelled at week / month zoom.
      chart.push(
        `<text x="${bar.x + bar.width + 6}" y="${bar.y + bar.height / 2}" fill="${c.text}" font-size="12.5" font-weight="600" dominant-baseline="central">${esc(name)}</text>`,
      );
    }
  });

  parts.push(
    `<g clip-path="url(#${panelClip})"><g transform="translate(${chartX},${chartY})">${chart.join("")}</g></g>`,
  );

  // ---- Axis ----
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
    // Clip the band label to its own segment so a narrow month never bleeds
    // into the next one.
    const label = truncateToWidth(seg.label, seg.width - 14, fontShorthand(700, 12, family));
    if (label) {
      axis.push(
        `<text x="${seg.x + 10}" y="${AXIS_TOP_HEIGHT / 2}" fill="${c.text}" font-size="12" font-weight="700" dominant-baseline="central">${esc(label)}</text>`,
      );
    }
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
      `<text x="${center}" y="${AXIS_TOP_HEIGHT + AXIS_BOTTOM_HEIGHT / 2}" fill="${
        tick.major ? c.text : c.textMuted
      }" font-size="11" font-weight="${tick.major ? 600 : 400}" text-anchor="${anchor}" dominant-baseline="central">${esc(tick.label)}</text>`,
    );
  }
  axis.push(
    `<line x1="0" y1="${AXIS_HEIGHT}" x2="${layout.totalWidth}" y2="${AXIS_HEIGHT}" stroke="${c.gridLineStrong}"/>`,
  );
  parts.push(
    `<g clip-path="url(#${panelClip})"><g transform="translate(${chartX},${axisY})">${axis.join("")}</g></g>`,
  );

  // ---- Left task-name column ----
  const nameFont = fontShorthand(600, 13, family);
  const dateFont = fontShorthand(400, 10.5, family);
  const labels: string[] = [];
  labels.push(
    `<text x="0" y="${AXIS_HEIGHT / 2}" fill="${c.textMuted}" font-size="11" font-weight="600" dominant-baseline="central">TÂCHES</text>`,
  );
  ordered.forEach((task, i) => {
    const y = AXIS_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;
    const fill = resolveTaskColor(task, theme.barPalette);
    const textX = 16;
    const available = p.labelWidth - textX - 10;
    if (isMilestone(task)) {
      const r = 4.5;
      labels.push(
        `<polygon points="5,${y - r} ${5 + r},${y} 5,${y + r} ${5 - r},${y}" fill="${fill}"/>`,
      );
    } else {
      labels.push(`<circle cx="5" cy="${y}" r="4" fill="${fill}"/>`);
    }
    labels.push(
      `<text x="${textX}" y="${y - 6}" fill="${c.text}" font-size="13" font-weight="600" dominant-baseline="central">${esc(
        truncateToWidth(task.name || "Sans titre", available, nameFont),
      )}</text>`,
    );
    labels.push(
      `<text x="${textX}" y="${y + 9}" fill="${c.textMuted}" font-size="10.5" dominant-baseline="central">${esc(
        truncateToWidth(rowMeta(task), available, dateFont),
      )}</text>`,
    );
  });
  parts.push(`<g transform="translate(${P},${axisY})">${labels.join("")}</g>`);

  // Column separator.
  parts.push(
    `<line x1="${chartX}" y1="${axisY}" x2="${chartX}" y2="${chartY + rowsHeight}" stroke="${c.gridLineStrong}"/>`,
  );

  // ---- Legend ----
  if (p.legendRows > 0) {
    const legend: string[] = [];
    ordered.forEach((task, i) => {
      const col = i % p.legendCols;
      const row = Math.floor(i / p.legendCols);
      const x = col * LEGEND_COL_W;
      const y = row * LEGEND_ROW_H + LEGEND_ROW_H / 2;
      const fill = resolveTaskColor(task, theme.barPalette);
      if (isMilestone(task)) {
        const r = 4.5;
        const cx = x + 5;
        legend.push(
          `<polygon points="${cx},${y - r} ${cx + r},${y} ${cx},${y + r} ${cx - r},${y}" fill="${fill}"/>`,
        );
      } else {
        legend.push(`<rect x="${x}" y="${y - 4}" width="10" height="8" rx="2" fill="${fill}"/>`);
      }
      legend.push(
        `<text x="${x + 18}" y="${y}" fill="${c.text}" font-size="11" dominant-baseline="central">${esc(
          truncateToWidth(task.name || "Sans titre", LEGEND_COL_W - 30, fontShorthand(400, 11, family)),
        )}</text>`,
      );
    });
    parts.push(`<g transform="translate(${P},${p.legendY})">${legend.join("")}</g>`);
  }

  // ---- Footer ----
  if (p.opts.showFooter) {
    parts.push(
      `<text x="${P}" y="${p.height - P + 4}" fill="${c.textMuted}" font-size="10">${esc(
        `Généré le ${formatISO(p.opts.today ?? todayForFooter(), "d MMMM yyyy")}`,
      )}</text>`,
    );
  }

  const styleFamily = family.replace(/"/g, "'");
  const style = `${fontCss}text{font-family:${styleFamily};}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" ` +
    `viewBox="0 0 ${p.width} ${p.height}" font-family="${esc(styleFamily)}">` +
    `<style>${style}</style>${parts.join("")}</svg>`
  );
}

/** Build an SVG that stands on its own outside the app, fonts included. */
export async function buildStandaloneSvg(
  state: GanttState,
  theme: Theme,
  options: BuildSvgOptions = {},
): Promise<string> {
  const fontCss = await fontCssForTheme(theme.fontKind);
  return buildSvg(state, theme, options, fontCss);
}

function todayForFooter(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function subtitle(state: GanttState): string {
  if (state.tasks.length === 0) return "Aucune tâche";
  const starts = state.tasks.map((t) => t.start).sort();
  const ends = state.tasks.map((t) => t.end).sort();
  const first = starts[0];
  const last = ends[ends.length - 1];
  const milestones = state.tasks.filter(isMilestone).length;
  const bars = state.tasks.length - milestones;
  const parts = [
    `${shortDate(first)} → ${shortDate(last)}`,
    `${spanDays(first, last)} jours`,
    `${bars} tâche${bars > 1 ? "s" : ""}`,
  ];
  if (milestones > 0) parts.push(`${milestones} jalon${milestones > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

/** Second line under a task name in the export's left column. */
function rowMeta(task: Task): string {
  if (isMilestone(task)) return shortDate(task.start);
  const progress = taskProgress(task);
  const range = dateRangeLabel(task.start, task.end);
  return progress > 0 ? `${range} · ${Math.round(progress * 100)} %` : range;
}

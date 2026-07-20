// Theme definitions are plain data — consumed by both the on-screen renderer
// and the export pipeline so the two always match. No React / DOM here either.

export interface ThemeColors {
  background: string;
  surface: string; // background of the chart plotting area
  gridLine: string;
  gridLineStrong: string;
  text: string;
  textMuted: string;
  todayMarker: string;
  weekendBand: string;
  barStroke: string; // bar outline, or "none"
  zebra: string; // tint for alternating rows
}

export interface Theme {
  id: string;
  name: string;
  fontFamily: string;
  barRadius: number; // px
  zebra: boolean;
  weekendShade: boolean;
  colors: ThemeColors;
  /** Bar fill colors; a task's colorKey indexes into this palette. */
  barPalette: string[];
}

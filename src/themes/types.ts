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
  /** Brand accent: buttons, active states, focus rings. */
  accent: string;
  /** Second stop of the brand gradient (accent -> accentAlt). */
  accentAlt: string;
  /** Ink used on top of a solid `accent` fill. */
  onAccent: string;
  /** Dependency arrow / link color. */
  link: string;
}

/** Which built-in font stack a theme uses. Drives export font embedding. */
export type FontKind = "sans" | "serif" | "mono";

export interface Theme {
  id: string;
  name: string;
  fontKind: FontKind;
  fontFamily: string;
  barRadius: number; // px
  zebra: boolean;
  weekendShade: boolean;
  /** True for themes designed against a dark surface. */
  dark: boolean;
  colors: ThemeColors;
  /**
   * Bar fill colors; a task's colorKey indexes into this palette.
   * Fixed order — never cycled or re-sorted; the order is what keeps
   * adjacent bars distinguishable under color-vision deficiency.
   */
  barPalette: string[];
}

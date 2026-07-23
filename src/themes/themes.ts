import type { Theme } from "./types";

// Four themes over ONE brand color system.
//
// The bar palette is deliberately shared: identity color follows the task, so
// two themes must never repaint the same task differently. What a theme changes
// is surface, typography and shape — not series identity.
//
// The two palettes below were produced by snapping the brand gradient
// (amber -> orange -> magenta) onto a categorical ramp and validating them:
// OKLCH lightness band, chroma floor, protan/deutan/tritan adjacent separation
// (worst pair dE 12.6 light / 12.2 dark, target >= 8), normal-vision floor and
// >= 3:1 contrast against the theme surface. Slots 1-2 carry the brand hues;
// the rest step around the wheel at matched lightness so the set still reads
// warm. The ORDER is the safety mechanism — never re-sort or cycle it.

const SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Categorical bar palette for light surfaces. Fixed order. */
export const LIGHT_PALETTE = [
  "#d9257e", // 1 magenta  (brand)
  "#c97a10", // 2 amber    (brand)
  "#2f7fd4", // 3 blue
  "#e2603b", // 4 coral
  "#0f9d8f", // 5 teal
  "#7c4bd0", // 6 violet
  "#4aa32a", // 7 green
  "#3f6ea8", // 8 indigo
];

/** Categorical bar palette for dark surfaces. Own steps, not a flip. */
export const DARK_PALETTE = [
  "#e83f8e", // 1 magenta  (brand)
  "#bf8016", // 2 amber    (brand)
  "#4a8ae0", // 3 blue
  "#e2673f", // 4 coral
  "#12a692", // 5 teal
  "#9673ec", // 6 violet
  "#4da22c", // 7 green
  "#5f8fd0", // 8 indigo
];

/** Brand gradient stops, used for the logo and accent fills. */
export const BRAND_GRADIENT = ["#f5a623", "#f0762e", "#e5187f"] as const;

export const themes: Theme[] = [
  {
    id: "light",
    name: "Clair",
    fontKind: "sans",
    fontFamily: SANS,
    barRadius: 7,
    zebra: false,
    weekendShade: true,
    dark: false,
    colors: {
      background: "#faf7f4",
      surface: "#fffcf9",
      gridLine: "#efe8e2",
      gridLineStrong: "#ded4cc",
      text: "#241d21",
      textMuted: "#8b7f85",
      todayMarker: "#e11d48",
      weekendBand: "#f6f1ec",
      barStroke: "none",
      zebra: "#fdf9f5",
      accent: "#d9257e",
      accentAlt: "#f0a92b",
      onAccent: "#ffffff",
      link: "#a2959c",
    },
    barPalette: LIGHT_PALETTE,
  },
  {
    id: "dark",
    name: "Sombre",
    fontKind: "sans",
    fontFamily: SANS,
    barRadius: 7,
    zebra: false,
    weekendShade: true,
    dark: true,
    colors: {
      background: "#120f15",
      surface: "#17141b",
      gridLine: "#282331",
      gridLineStrong: "#3b3446",
      text: "#f3eef4",
      textMuted: "#8d8395",
      todayMarker: "#fb5c7d",
      weekendBand: "#1d1924",
      barStroke: "none",
      zebra: "#1c1823",
      accent: "#e83f8e",
      accentAlt: "#f2b544",
      onAccent: "#ffffff",
      link: "#6e6579",
    },
    barPalette: DARK_PALETTE,
  },
  {
    id: "pastel",
    name: "Papier",
    fontKind: "serif",
    fontFamily: SERIF,
    barRadius: 12,
    zebra: true,
    weekendShade: true,
    dark: false,
    colors: {
      background: "#fbf5ec",
      surface: "#fffaf2",
      gridLine: "#f0e5d6",
      gridLineStrong: "#e0d0bb",
      text: "#33281f",
      textMuted: "#94836f",
      todayMarker: "#c2410c",
      weekendBand: "#f7efe3",
      barStroke: "#fffaf2",
      zebra: "#fbf4ea",
      accent: "#b8336a",
      accentAlt: "#d98324",
      onAccent: "#ffffff",
      link: "#b2a08a",
    },
    barPalette: LIGHT_PALETTE,
  },
  {
    id: "blueprint",
    name: "Encre",
    fontKind: "mono",
    fontFamily: MONO,
    barRadius: 4,
    zebra: false,
    weekendShade: false,
    dark: true,
    colors: {
      background: "#171021",
      surface: "#1d1429",
      gridLine: "#2e2140",
      gridLineStrong: "#443056",
      text: "#efe6f7",
      textMuted: "#9a86ad",
      todayMarker: "#ffc861",
      weekendBand: "#20172d",
      barStroke: "#3a2a4d",
      zebra: "#211830",
      accent: "#e83f8e",
      accentAlt: "#f5a623",
      onAccent: "#ffffff",
      link: "#6b5580",
    },
    barPalette: DARK_PALETTE,
  },
];

export const DEFAULT_THEME_ID = "light";

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}

/**
 * The counterpart theme when toggling light/dark, preserving the "flavour"
 * (plain vs. textured) the user already chose.
 */
export function counterpartThemeId(id: string): string {
  switch (id) {
    case "light":
      return "dark";
    case "dark":
      return "light";
    case "pastel":
      return "blueprint";
    case "blueprint":
      return "pastel";
    default:
      return "dark";
  }
}

/** Write the theme's colors as CSS variables on the given element (default :root). */
export function applyTheme(theme: Theme, el: HTMLElement = document.documentElement): void {
  const c = theme.colors;
  const set = (k: string, v: string) => el.style.setProperty(k, v);
  set("--bg", c.background);
  set("--surface", c.surface);
  set("--grid", c.gridLine);
  set("--grid-strong", c.gridLineStrong);
  set("--text", c.text);
  set("--text-muted", c.textMuted);
  set("--today", c.todayMarker);
  set("--weekend", c.weekendBand);
  set("--zebra", c.zebra);
  set("--bar-stroke", c.barStroke);
  set("--accent", c.accent);
  set("--accent-alt", c.accentAlt);
  set("--on-accent", c.onAccent);
  set("--link", c.link);
  set("--font", theme.fontFamily);
  set("color-scheme", theme.dark ? "dark" : "light");
}

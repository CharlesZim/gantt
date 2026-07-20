import type { Theme } from "./types";

// Four distinct, polished themes. The active theme writes CSS variables on
// :root (see applyTheme) so Tailwind classes and inline SVG stay in sync.

const INTER = "'Inter', system-ui, -apple-system, sans-serif";
const SERIF = "'Georgia', 'Times New Roman', serif";
const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";

export const themes: Theme[] = [
  {
    id: "light",
    name: "Clair minimal",
    fontFamily: INTER,
    barRadius: 7,
    zebra: false,
    weekendShade: true,
    colors: {
      background: "#f7f7f5",
      surface: "#ffffff",
      gridLine: "#ececea",
      gridLineStrong: "#dcdcd8",
      text: "#1f2430",
      textMuted: "#8a8f9c",
      todayMarker: "#ef4444",
      weekendBand: "#f4f4f1",
      barStroke: "none",
      zebra: "#fafafa",
    },
    barPalette: [
      "#6366f1",
      "#0ea5e9",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#ec4899",
      "#8b5cf6",
      "#14b8a6",
    ],
  },
  {
    id: "dark",
    name: "Sombre",
    fontFamily: INTER,
    barRadius: 7,
    zebra: false,
    weekendShade: true,
    colors: {
      background: "#0f1115",
      surface: "#171a21",
      gridLine: "#242833",
      gridLineStrong: "#333947",
      text: "#eef1f7",
      textMuted: "#7d8494",
      todayMarker: "#f87171",
      weekendBand: "#1b1f28",
      barStroke: "none",
      zebra: "#1c202a",
    },
    barPalette: [
      "#818cf8",
      "#38bdf8",
      "#34d399",
      "#fbbf24",
      "#fb7185",
      "#f472b6",
      "#a78bfa",
      "#2dd4bf",
    ],
  },
  {
    id: "pastel",
    name: "Pastel",
    fontFamily: SERIF,
    barRadius: 12,
    zebra: true,
    weekendShade: true,
    colors: {
      background: "#fdf6f0",
      surface: "#fffaf5",
      gridLine: "#f0e4d8",
      gridLineStrong: "#e5d3c2",
      text: "#5b4636",
      textMuted: "#a89484",
      todayMarker: "#e07a5f",
      weekendBand: "#f7ede2",
      barStroke: "#ffffff",
      zebra: "#fbf2e9",
    },
    barPalette: [
      "#f2a9a0",
      "#f6c28b",
      "#f7dba7",
      "#b8d8ba",
      "#a7c7d9",
      "#c9b6e4",
      "#e8a5c4",
      "#94cbbb",
    ],
  },
  {
    id: "blueprint",
    name: "Blueprint",
    fontFamily: MONO,
    barRadius: 4,
    zebra: false,
    weekendShade: false,
    colors: {
      background: "#0b1f3a",
      surface: "#0e2647",
      gridLine: "#1c3a63",
      gridLineStrong: "#2f5488",
      text: "#e8f0ff",
      textMuted: "#7fa0c8",
      todayMarker: "#ffd166",
      weekendBand: "#0c2140",
      barStroke: "#9dc3ff",
      zebra: "#0d2342",
    },
    barPalette: [
      "#5b9dff",
      "#7fb2ff",
      "#63c7d6",
      "#8ad0a8",
      "#c4b56b",
      "#d68f8f",
      "#a99bd6",
      "#6fc0b3",
    ],
  },
];

export const DEFAULT_THEME_ID = "light";

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
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
  set("--font", theme.fontFamily);
  set("color-scheme", theme.id === "dark" || theme.id === "blueprint" ? "dark" : "light");
}

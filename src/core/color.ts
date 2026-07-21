// Pure color resolution. No React / DOM.
import type { Task } from "./types";

/** The effective bar color: an explicit custom hex, else the theme palette. */
export function resolveTaskColor(task: Pick<Task, "color" | "colorKey">, palette: string[]): string {
  if (task.color && isHexColor(task.color)) return task.color;
  return palette[task.colorKey % palette.length];
}

/** Whether a string is a valid #RGB or #RRGGBB hex color. */
export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Normalize a hex string to lowercase #rrggbb, or null if invalid. */
export function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!isHexColor(v)) return null;
  if (v.length === 4) {
    return "#" + v.slice(1).split("").map((ch) => ch + ch).join("");
  }
  return v;
}

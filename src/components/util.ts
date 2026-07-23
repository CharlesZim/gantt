/** Expand #rgb / #rrggbb to its three 0-255 channels. */
function channels(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const full =
    c.length === 3
      ? c
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : c;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Same hex color at a given alpha, as an `rgba()` string. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pick black or white text for maximum legibility over a solid hex color. */
export function readableTextColor(hex: string): string {
  const [r255, g255, b255] = channels(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.55 ? "#1f2430" : "#ffffff";
}

/** Turn a project title into a filename-safe slug. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip combining diacritics
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "gantt"
  );
}

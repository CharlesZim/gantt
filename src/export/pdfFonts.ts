// Register Inter on a jsPDF document so the vector PDF is set in the same
// typeface as the screen and the PNG.
//
// svg2pdf resolves an SVG `font-family` against `pdf.getFontList()` and falls
// back to Helvetica when nothing matches, so the font has to be registered
// before `doc.svg(...)` runs. jsPDF only accepts TTF/OTF; `npm run fonts:build`
// derives the TTFs from the WOFFs @fontsource ships (see scripts/).
import type jsPDF from "jspdf";
import type { FontKind } from "../themes/types";

/**
 * jsPDF style key per weight, matching svg2pdf's own
 * `combineFontStyleAndFontWeight` for jsPDF 2.4+: 400 -> "normal",
 * 700 -> "bold", anything else -> "<weight>normal". If those keys drift the
 * text silently falls back, so they are asserted in the tests.
 */
export const PDF_FONT_STYLES: { weight: number; style: string }[] = [
  { weight: 400, style: "normal" },
  { weight: 600, style: "600normal" },
  { weight: 700, style: "bold" },
];

export const PDF_FONT_NAME = "Inter";

const cache = new Map<number, string>();

async function ttfBase64(weight: number): Promise<string> {
  const hit = cache.get(weight);
  if (hit !== undefined) return hit;

  const base = import.meta.env.BASE_URL ?? "/";
  const response = await fetch(`${base}fonts/inter-${weight}.ttf`.replace(/\/{2,}/g, "/"));
  if (!response.ok) throw new Error(`Police PDF introuvable (Inter ${weight})`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(binary);
  cache.set(weight, b64);
  return b64;
}

/**
 * Embed Inter into `doc` and return the family name svg2pdf will match, or
 * null when the theme does not use it (serif and mono themes ride on jsPDF's
 * built-in Times / Courier, which svg2pdf already aliases them to) or when the
 * font files are unavailable — in which case the export still succeeds with
 * the built-in faces rather than failing outright.
 */
export async function registerPdfFont(doc: jsPDF, fontKind: FontKind): Promise<string | null> {
  if (fontKind !== "sans") return null;

  try {
    await Promise.all(
      PDF_FONT_STYLES.map(async ({ weight, style }) => {
        const b64 = await ttfBase64(weight);
        const file = `${PDF_FONT_NAME}-${weight}.ttf`;
        doc.addFileToVFS(file, b64);
        doc.addFont(file, PDF_FONT_NAME, style);
      }),
    );
    doc.setFont(PDF_FONT_NAME, "normal");
    return PDF_FONT_NAME;
  } catch {
    return null;
  }
}

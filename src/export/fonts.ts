// Font embedding for exports.
//
// A standalone SVG that merely *names* "Inter" renders in a fallback face
// everywhere it matters: an <img>-rasterised SVG (our PNG path) runs in a
// sandbox that loads no external resources, and an .svg file opened on another
// machine has no access to the app's stylesheet either. So the export inlines
// the actual font bytes as an @font-face with a data: URI.
//
// Only the Latin subset is embedded, and only the three weights the chart uses.
import interLatin400 from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import interLatin600 from "@fontsource/inter/files/inter-latin-600-normal.woff2?url";
import interLatin700 from "@fontsource/inter/files/inter-latin-700-normal.woff2?url";
import type { FontKind } from "../themes/types";

const WEIGHTS: { weight: number; url: string }[] = [
  { weight: 400, url: interLatin400 },
  { weight: 600, url: interLatin600 },
  { weight: 700, url: interLatin700 },
];

let cached: string | null = null;
let inflight: Promise<string> | null = null;

async function toBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Police introuvable : ${url}`);
  const buffer = new Uint8Array(await response.arrayBuffer());
  // btoa needs a binary string; chunk it so large fonts don't blow the stack.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * `@font-face` rules embedding Inter, ready to drop into an SVG <style>.
 * Resolves to "" if the font files cannot be read — the export still succeeds,
 * it just falls back to a system sans.
 */
export async function interFontFaceCss(): Promise<string> {
  if (cached !== null) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const faces = await Promise.all(
        WEIGHTS.map(async ({ weight, url }) => {
          const data = await toBase64(url);
          return `@font-face{font-family:'Inter';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
        }),
      );
      cached = faces.join("");
    } catch {
      cached = "";
    }
    return cached;
  })();

  return inflight;
}

/**
 * CSS to embed for a theme. Only the sans themes use a webfont; the serif and
 * mono themes deliberately ride on system faces (Georgia / SF Mono etc.), which
 * are present on every target platform and need no embedding.
 */
export async function fontCssForTheme(fontKind: FontKind): Promise<string> {
  return fontKind === "sans" ? interFontFaceCss() : "";
}

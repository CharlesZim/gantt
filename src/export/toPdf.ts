import { ensureFontsReady } from "./download";

/**
 * Produce a vector PDF (selectable text, crisp at any zoom) from a standalone
 * SVG string. The page is sized to the content in landscape point units.
 *
 * jsPDF + svg2pdf are heavy, so they are imported on demand — the export code
 * only enters the bundle when a PDF is actually requested.
 */
export async function svgToPdf(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  await ensureFontsReady();
  const { jsPDF } = await import("jspdf");
  await import("svg2pdf.js");

  const doc = new jsPDF({
    orientation: width >= height ? "landscape" : "portrait",
    unit: "pt",
    format: [width, height],
    compress: true,
  });

  const el = new DOMParser().parseFromString(svg, "image/svg+xml")
    .documentElement as unknown as SVGSVGElement;

  await doc.svg(el, { x: 0, y: 0, width, height });
  return doc.output("blob");
}

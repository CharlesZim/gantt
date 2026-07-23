import type { FontKind } from "../themes/types";
import { ensureFontsReady } from "./download";
import { layoutPage, type Orientation, type PaperId } from "./paper";
import { registerPdfFont } from "./pdfFonts";

export interface PdfOptions {
  paper: PaperId;
  orientation: Orientation;
  /** Page margin in points (1/72"). Ignored for the "content" page size. */
  marginPt: number;
  /** Page background, painted before the artwork so margins are not white-on-dark. */
  background: string;
  /** Theme typeface, so the matching font can be embedded. */
  fontKind: FontKind;
}

export interface PdfResult {
  blob: Blob;
  /** Scale the artwork was reduced by to fit the page (1 = no reduction). */
  scale: number;
  /** Family the text was actually set in, for reporting back to the user. */
  fontUsed: string;
}

/**
 * Produce a vector PDF (selectable text, crisp at any zoom) from a standalone
 * SVG string, placed on a real page format.
 *
 * Inter is embedded into the document before the SVG is drawn, because svg2pdf
 * silently falls back to Helvetica for any family jsPDF does not know about.
 * The serif and mono themes intentionally use jsPDF's built-in Times / Courier.
 *
 * jsPDF + svg2pdf are heavy, so they are imported on demand: the export code
 * only enters the bundle when a PDF is actually requested.
 */
export async function svgToPdf(
  svg: string,
  width: number,
  height: number,
  options: PdfOptions,
): Promise<PdfResult> {
  await ensureFontsReady();
  const { jsPDF } = await import("jspdf");
  await import("svg2pdf.js");

  const page = layoutPage({ width, height }, options.paper, options.orientation, options.marginPt);

  const doc = new jsPDF({
    orientation: page.pageWidth >= page.pageHeight ? "landscape" : "portrait",
    unit: "pt",
    format: [page.pageWidth, page.pageHeight],
    compress: true,
  });

  // Must happen before doc.svg(): svg2pdf resolves font-family against the
  // fonts already registered on the document.
  const registered = await registerPdfFont(doc, options.fontKind);

  // Paint the page so the margin matches the chart's background instead of
  // leaving raw white around a dark theme.
  doc.setFillColor(options.background);
  doc.rect(0, 0, page.pageWidth, page.pageHeight, "F");

  const el = new DOMParser().parseFromString(svg, "image/svg+xml")
    .documentElement as unknown as SVGSVGElement;

  await doc.svg(el, { x: page.x, y: page.y, width: page.width, height: page.height });
  return {
    blob: doc.output("blob"),
    scale: page.scale,
    fontUsed: registered ?? (options.fontKind === "mono" ? "Courier" : "Times"),
  };
}

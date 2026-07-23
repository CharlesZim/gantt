// Page geometry for PDF export. Sizes are in PostScript points (1/72"),
// which is also the unit jsPDF works in, so no conversion is needed.

export type PaperId = "content" | "a4" | "a3" | "letter";
export type Orientation = "landscape" | "portrait";

export interface Paper {
  id: PaperId;
  label: string;
  /** Portrait dimensions in points; null means "fit the page to the chart". */
  size: { width: number; height: number } | null;
}

export const PAPERS: Paper[] = [
  { id: "a4", label: "A4", size: { width: 595.28, height: 841.89 } },
  { id: "a3", label: "A3", size: { width: 841.89, height: 1190.55 } },
  { id: "letter", label: "Letter", size: { width: 612, height: 792 } },
  { id: "content", label: "Sur mesure", size: null },
];

export function getPaper(id: PaperId): Paper {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[0];
}

export interface PageLayout {
  /** Page box in points. */
  pageWidth: number;
  pageHeight: number;
  /** Where the artwork is placed inside the page, in points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Scale applied to the artwork; 1 when the page is sized to the content. */
  scale: number;
}

/**
 * Place `content` (in px, treated 1:1 as points) on a page.
 *
 * Fixed formats scale the artwork down to fit inside the margins — never up,
 * so a small chart is not blown out into a blurry full-bleed — and centre it.
 * "content" returns a page cut exactly to the artwork with no margin.
 */
export function layoutPage(
  content: { width: number; height: number },
  paperId: PaperId,
  orientation: Orientation,
  marginPt: number,
): PageLayout {
  const paper = getPaper(paperId);

  if (!paper.size) {
    return {
      pageWidth: content.width + marginPt * 2,
      pageHeight: content.height + marginPt * 2,
      x: marginPt,
      y: marginPt,
      width: content.width,
      height: content.height,
      scale: 1,
    };
  }

  const portrait = paper.size;
  const pageWidth = orientation === "landscape" ? portrait.height : portrait.width;
  const pageHeight = orientation === "landscape" ? portrait.width : portrait.height;

  const availableW = Math.max(1, pageWidth - marginPt * 2);
  const availableH = Math.max(1, pageHeight - marginPt * 2);
  const scale = Math.min(1, availableW / content.width, availableH / content.height);

  const width = content.width * scale;
  const height = content.height * scale;

  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
    scale,
  };
}

/** The orientation that wastes the least paper for a given aspect ratio. */
export function suggestOrientation(content: { width: number; height: number }): Orientation {
  return content.width >= content.height ? "landscape" : "portrait";
}

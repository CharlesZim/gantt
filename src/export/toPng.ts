import { ensureFontsReady } from "./download";

const MAX_CANVAS_DIM = 16000; // browser canvas safety limit

export interface PngResult {
  blob: Blob;
  scaleUsed: number;
}

/**
 * Rasterize a standalone SVG string to a PNG Blob at the requested scale.
 * Falls back to a smaller scale if the canvas would exceed browser limits.
 */
export async function svgToPng(
  svg: string,
  baseWidth: number,
  baseHeight: number,
  scale = 2,
): Promise<PngResult> {
  await ensureFontsReady();

  // Clamp the scale so neither dimension blows past the canvas limit.
  const maxScale = Math.min(
    MAX_CANVAS_DIM / baseWidth,
    MAX_CANVAS_DIM / baseHeight,
    scale,
  );
  const scaleUsed = Math.max(0.5, Math.min(scale, maxScale));

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(baseWidth * scaleUsed);
    canvas.height = Math.round(baseHeight * scaleUsed);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D non disponible");
    ctx.setTransform(scaleUsed, 0, 0, scaleUsed, 0, 0);
    ctx.drawImage(img, 0, 0, baseWidth, baseHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Échec de la conversion PNG"))),
        "image/png",
      );
    });
    return { blob, scaleUsed };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger le SVG"));
    img.src = url;
  });
}

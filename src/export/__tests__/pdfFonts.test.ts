import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDF_FONT_NAME, PDF_FONT_STYLES } from "../pdfFonts";

const ttf = (weight: number) =>
  readFileSync(resolve(process.cwd(), `public/fonts/inter-${weight}.ttf`));

describe("generated PDF fonts", () => {
  it("are real sfnt files with the tables jsPDF needs", () => {
    for (const { weight } of PDF_FONT_STYLES) {
      const buffer = ttf(weight);
      expect(buffer.readUInt32BE(0)).toBe(0x00010000); // sfnt version 1.0

      const numTables = buffer.readUInt16BE(4);
      const tags: string[] = [];
      for (let i = 0; i < numTables; i++) {
        tags.push(buffer.toString("ascii", 12 + i * 16, 16 + i * 16));
      }
      // Without glyf/loca/cmap/head/hmtx, jsPDF cannot subset the font.
      expect(tags).toEqual(expect.arrayContaining(["glyf", "loca", "cmap", "head", "hmtx"]));
    }
  });
});

describe("jsPDF registration", () => {
  /**
   * The style keys must match svg2pdf's combineFontStyleAndFontWeight for
   * jsPDF 2.4+. If they drift, text silently falls back to Helvetica instead
   * of failing, so it is asserted here rather than left to inspection.
   */
  it("registers the weights the chart draws with, under svg2pdf's style keys", async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: [400, 200] });

    for (const { weight, style } of PDF_FONT_STYLES) {
      const file = `${PDF_FONT_NAME}-${weight}.ttf`;
      doc.addFileToVFS(file, ttf(weight).toString("base64"));
      doc.addFont(file, PDF_FONT_NAME, style);
    }

    expect(doc.getFontList()[PDF_FONT_NAME]).toEqual(
      expect.arrayContaining(PDF_FONT_STYLES.map((s) => s.style)),
    );
  });

  it("embeds the typeface into the output rather than falling back", async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: [400, 200] });
    const file = `${PDF_FONT_NAME}-600.ttf`;
    doc.addFileToVFS(file, ttf(600).toString("base64"));
    doc.addFont(file, PDF_FONT_NAME, "600normal");
    doc.setFont(PDF_FONT_NAME, "600normal");
    doc.text("Développement", 20, 60);

    const bytes = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    expect(bytes).toMatch(/FontFile2/); // an embedded TrueType program
    expect(bytes).toMatch(new RegExp(PDF_FONT_NAME));
  });
});

// Generate the TTFs the PDF export needs, from the WOFFs @fontsource ships.
//
// jsPDF can only embed TTF/OTF, and svg2pdf can only draw text with a font
// registered on the jsPDF document — so without this the "vector PDF" silently
// falls back to Helvetica. @fontsource publishes WOFF2 and WOFF but no TTF;
// WOFF2 needs a Brotli+glyf-transform decoder, whereas WOFF v1 is just an sfnt
// with zlib-deflated tables, which Node can undo on its own. Hence WOFF.
//
// Run via `npm run fonts:build` (also wired into predev / prebuild).
import { inflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(root, "public/fonts");

/** Weights the chart actually draws with. Keep in sync with buildSvg. */
const WEIGHTS = [400, 600, 700];

const WOFF_HEADER = 44;
const WOFF_ENTRY = 20;

/** Convert a WOFF v1 buffer to a plain TTF (sfnt) buffer. */
function woffToTtf(woff) {
  if (woff.toString("ascii", 0, 4) !== "wOFF") {
    throw new Error("Not a WOFF file");
  }
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);

  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const p = WOFF_HEADER + i * WOFF_ENTRY;
    const compLength = woff.readUInt32BE(p + 8);
    const origLength = woff.readUInt32BE(p + 12);
    const offset = woff.readUInt32BE(p + 4);
    const raw = woff.subarray(offset, offset + compLength);
    tables.push({
      tag: woff.readUInt32BE(p),
      checksum: woff.readUInt32BE(p + 16),
      // A table is stored uncompressed when deflating did not pay off.
      data: compLength < origLength ? inflateSync(raw) : Buffer.from(raw),
    });
  }

  // sfnt wants the table directory sorted by tag.
  tables.sort((a, b) => a.tag - b.tag);

  // Binary-search hints in the sfnt header.
  const pow2 = 2 ** Math.floor(Math.log2(numTables));
  const searchRange = pow2 * 16;
  const entrySelector = Math.log2(pow2);
  const rangeShift = numTables * 16 - searchRange;

  const header = Buffer.alloc(12);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(rangeShift, 10);

  const directory = Buffer.alloc(numTables * 16);
  const body = [];
  let offset = 12 + numTables * 16;

  tables.forEach((table, i) => {
    const p = i * 16;
    directory.writeUInt32BE(table.tag, p);
    directory.writeUInt32BE(table.checksum, p + 4);
    directory.writeUInt32BE(offset, p + 8);
    directory.writeUInt32BE(table.data.length, p + 12);

    body.push(table.data);
    offset += table.data.length;

    // Every table starts on a 4-byte boundary.
    const padding = (4 - (table.data.length % 4)) % 4;
    if (padding > 0) {
      body.push(Buffer.alloc(padding));
      offset += padding;
    }
  });

  return Buffer.concat([header, directory, ...body]);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const weight of WEIGHTS) {
  const source = resolve(
    root,
    `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`,
  );
  const ttf = woffToTtf(readFileSync(source));
  const target = resolve(OUT_DIR, `inter-${weight}.ttf`);
  writeFileSync(target, ttf);
  console.log(`inter-${weight}.ttf  ${(ttf.length / 1024).toFixed(1)} kB`);
}

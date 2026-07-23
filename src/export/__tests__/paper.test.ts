import { describe, expect, it } from "vitest";
import { layoutPage, suggestOrientation } from "../paper";

const A4_W = 595.28;
const A4_H = 841.89;

describe("layoutPage - content size", () => {
  it("cuts the page to the artwork plus the margin", () => {
    const page = layoutPage({ width: 800, height: 400 }, "content", "landscape", 20);
    expect(page.pageWidth).toBe(840);
    expect(page.pageHeight).toBe(440);
    expect(page.scale).toBe(1);
    expect(page).toMatchObject({ x: 20, y: 20, width: 800, height: 400 });
  });
});

describe("layoutPage - fixed formats", () => {
  it("swaps the page box in landscape", () => {
    const page = layoutPage({ width: 100, height: 100 }, "a4", "landscape", 0);
    expect(page.pageWidth).toBeCloseTo(A4_H);
    expect(page.pageHeight).toBeCloseTo(A4_W);
  });

  it("scales an oversized chart down to fit inside the margins", () => {
    const page = layoutPage({ width: 4000, height: 500 }, "a4", "landscape", 28);
    expect(page.scale).toBeLessThan(1);
    expect(page.width).toBeLessThanOrEqual(A4_H - 56 + 0.01);
    expect(page.height).toBeLessThanOrEqual(A4_W - 56 + 0.01);
  });

  it("never enlarges a small chart", () => {
    const page = layoutPage({ width: 200, height: 100 }, "a4", "portrait", 28);
    expect(page.scale).toBe(1);
    expect(page.width).toBe(200);
  });

  it("centres the artwork on the page", () => {
    const page = layoutPage({ width: 200, height: 100 }, "a4", "portrait", 28);
    expect(page.x).toBeCloseTo((A4_W - 200) / 2);
    expect(page.y).toBeCloseTo((A4_H - 100) / 2);
  });

  it("survives a margin larger than the page", () => {
    const page = layoutPage({ width: 200, height: 100 }, "a4", "portrait", 5000);
    expect(page.scale).toBeGreaterThan(0);
    expect(Number.isFinite(page.width)).toBe(true);
  });
});

describe("suggestOrientation", () => {
  it("picks landscape for wide charts and portrait for tall ones", () => {
    expect(suggestOrientation({ width: 900, height: 300 })).toBe("landscape");
    expect(suggestOrientation({ width: 300, height: 900 })).toBe("portrait");
  });
});

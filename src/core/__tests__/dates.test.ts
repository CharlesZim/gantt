import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  clampISO,
  daysBetween,
  isValidISO,
  maxISO,
  minISO,
  spanDays,
} from "../dates";

describe("dates helpers", () => {
  it("computes signed calendar-day distance", () => {
    expect(daysBetween("2026-07-20", "2026-07-20")).toBe(0);
    expect(daysBetween("2026-07-20", "2026-07-25")).toBe(5);
    expect(daysBetween("2026-07-25", "2026-07-20")).toBe(-5);
  });

  it("crosses month and year boundaries correctly", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("computes inclusive span in days", () => {
    expect(spanDays("2026-07-20", "2026-07-20")).toBe(1);
    expect(spanDays("2026-07-20", "2026-07-22")).toBe(3);
  });

  it("adds and subtracts days", () => {
    expect(addDaysISO("2026-07-20", 3)).toBe("2026-07-23");
    expect(addDaysISO("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("clamps into a range", () => {
    expect(clampISO("2026-07-10", "2026-07-15", "2026-07-20")).toBe("2026-07-15");
    expect(clampISO("2026-07-25", "2026-07-15", "2026-07-20")).toBe("2026-07-20");
    expect(clampISO("2026-07-17", "2026-07-15", "2026-07-20")).toBe("2026-07-17");
  });

  it("finds min and max", () => {
    const dates = ["2026-07-20", "2026-01-05", "2026-12-31", "2026-06-15"];
    expect(minISO(dates)).toBe("2026-01-05");
    expect(maxISO(dates)).toBe("2026-12-31");
  });

  it("validates ISO strings", () => {
    expect(isValidISO("2026-07-20")).toBe(true);
    expect(isValidISO("2026-13-01")).toBe(false);
    expect(isValidISO("not-a-date")).toBe(false);
    expect(isValidISO("2026-7-1")).toBe(false);
  });
});

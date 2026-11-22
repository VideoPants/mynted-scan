import { describe, expect, it } from "vitest";
import {
  bordersFromAxisAligned,
  nudgeLine,
  subpixelPeak,
  ransacLine,
} from "./index.js";

describe("geometry", () => {
  it("subpixelPeak interpolates", () => {
    const samples = [1, 2, 5, 2, 1];
    const peak = subpixelPeak(samples, 2);
    expect(peak).toBeCloseTo(2, 1);
  });

  it("ransacLine fits a horizontal-ish cloud", () => {
    const points = Array.from({ length: 40 }, (_, i) => ({
      x: i,
      y: 10 + (i % 3 === 0 ? 0.2 : 0),
    }));
    const { inliers } = ransacLine(points, 50, 1.0, 1);
    expect(inliers.length).toBeGreaterThan(20);
  });

  it("nudgeLine moves horizontal line by mm", () => {
    const line = { x1: 0, y1: 10, x2: 100, y2: 10 };
    const nudged = nudgeLine(line, "horizontal", 0.1, 20);
    expect(nudged.y1).toBeCloseTo(12);
  });
});

describe("bordersFromAxisAligned", () => {
  it("converts px to mm", () => {
    const b = bordersFromAxisAligned(
      { L: 0, R: 1260, T: 0, B: 1760 },
      { L: 60, R: 1200, T: 60, B: 1700 },
      20,
    );
    expect(b.L).toBeCloseTo(3);
    expect(b.R).toBeCloseTo(3);
    expect(b.T).toBeCloseTo(3);
    expect(b.B).toBeCloseTo(3);
  });
});
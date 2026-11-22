import { describe, expect, it } from "vitest";
import {
  bordersFromAxisAligned,
  DEFAULT_POKEMON_PROFILE,
  nudgeLine,
} from "@mynted/centering-core";

describe("manual coordinate transforms", () => {
  it("round-trips mm via canonical px", () => {
    const px = DEFAULT_POKEMON_PROFILE.pxPerMm;
    const w = DEFAULT_POKEMON_PROFILE.widthMm * px;
    const h = DEFAULT_POKEMON_PROFILE.heightMm * px;
    const borders = bordersFromAxisAligned(
      { L: 0, R: w, T: 0, B: h },
      { L: 3 * px, R: w - 3 * px, T: 3 * px, B: h - 3 * px },
      px,
    );
    expect(borders.L).toBeCloseTo(3, 5);
    expect(borders.R).toBeCloseTo(3, 5);
  });

  it("nudges vertical line by 0.1 mm", () => {
    const line = { x1: 100, y1: 0, x2: 100, y2: 200 };
    const next = nudgeLine(line, "vertical", 0.1, 20);
    expect(next.x1 - line.x1).toBeCloseTo(2);
  });
});
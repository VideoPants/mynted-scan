import { describe, expect, it } from "vitest";
import {
  RESIDUAL_FLOOR_PP,
  manualUncertaintyPp,
  residualFromBorders,
} from "./measure.js";

describe("residualFromBorders", () => {
  it("floors at RESIDUAL_FLOOR_PP", () => {
    expect(RESIDUAL_FLOOR_PP).toBe(0.5);
    // Tiny edge uncertainty on balanced borders → clamp to floor.
    expect(residualFromBorders(3, 3, 0.01, 0.01)).toBe(RESIDUAL_FLOOR_PP);
  });

  it("manualUncertaintyPp uses 0.1 mm nudge", () => {
    const u = manualUncertaintyPp({ L: 3.6, R: 2.4, T: 2.4, B: 3.6 });
    expect(u.lr).toBeGreaterThanOrEqual(RESIDUAL_FLOOR_PP);
    expect(u.tb).toBeGreaterThanOrEqual(RESIDUAL_FLOOR_PP);
  });
});

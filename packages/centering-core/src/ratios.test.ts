import { describe, expect, it } from "vitest";
import {
  computeCeilings,
  loadGraders,
  passesThreshold,
} from "./graders.js";
import { lrRatio, tbRatio } from "./ratios.js";
import { faceFromBorders, buildReport } from "./measure.js";

describe("ratio math", () => {
  it("computes LR ratio with wider side", () => {
    const r = lrRatio({ L: 3.2, R: 2.8, T: 3, B: 3 });
    expect(r.raw).toBeCloseTo(53.333, 2);
    expect(r.wider).toBe("L");
  });

  it("computes TB ratio", () => {
    const r = tbRatio({ L: 3, R: 3, T: 2.5, B: 3.5 });
    expect(r.wider).toBe("B");
    expect(r.raw).toBeCloseTo(58.333, 2);
  });
});

describe("grader thresholds (no rounding)", () => {
  it("55.00 passes PSA 10 front", () => {
    expect(passesThreshold(55.0, 55)).toBe(true);
  });

  it("55.05 fails PSA 10 front", () => {
    expect(passesThreshold(55.05, 55)).toBe(false);
  });

  it("50/50 meets CGC Pristine front", () => {
    const face = faceFromBorders({
      face: "FRONT",
      borders: { L: 3, R: 3, T: 3, B: 3 },
      uncertaintyPp: { lr: 0, tb: 0 },
    });
    const ceilings = computeCeilings(
      { lr: face.lrRatio, tb: face.tbRatio, uncertaintyPp: 0 },
      null,
    );
    const cgc = ceilings.find((c) => c.company === "CGC");
    expect(cgc?.frontCeiling).toMatch(/Pristine/);
  });

  it("back at 76 caps PSA at 9", () => {
    // 76/24 on back → raw 76; PSA 10 back is 75, so fails 10; passes 9 (90)
    const back = faceFromBorders({
      face: "BACK",
      borders: { L: 7.6, R: 2.4, T: 3, B: 3 },
      uncertaintyPp: { lr: 0, tb: 0 },
    });
    const front = faceFromBorders({
      face: "FRONT",
      borders: { L: 3, R: 3, T: 3, B: 3 },
      uncertaintyPp: { lr: 0, tb: 0 },
    });
    const ceilings = computeCeilings(
      { lr: front.lrRatio, tb: front.tbRatio, uncertaintyPp: 0 },
      { lr: back.lrRatio, tb: back.tbRatio, uncertaintyPp: 0 },
    );
    const psa = ceilings.find((c) => c.company === "PSA");
    expect(psa?.overallCeiling).toMatch(/9/);
    expect(psa?.overallCeiling).not.toMatch(/Gem Mint 10/);
  });
});

describe("graders loader", () => {
  it("loads graders.json via zod", () => {
    const rows = loadGraders();
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.checkedOn)).toBe(true);
  });
});

describe("report", () => {
  it("builds a v1 report", () => {
    const front = faceFromBorders({
      face: "FRONT",
      borders: { L: 3.1, R: 2.9, T: 3.0, B: 3.0 },
    });
    const report = buildReport([front]);
    expect(report.version).toBe(1);
    expect(report.ceilings.length).toBe(4);
  });
});
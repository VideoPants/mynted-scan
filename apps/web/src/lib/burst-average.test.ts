import { describe, expect, it } from "vitest";
import { faceFromBorders } from "@mynted/centering-core";
import { averageBurstFaces } from "./burst-average";

describe("averageBurstFaces", () => {
  it("medians borders and sets framesUsed", () => {
    const mk = (L: number, R: number) =>
      faceFromBorders({
        face: "FRONT",
        borders: { L, R, T: 3, B: 3 },
        status: "OK",
        captureSource: "CAMERA",
        uncertaintyPp: { lr: 0.3, tb: 0.3 },
      });
    const out = averageBurstFaces([mk(3.5, 2.5), mk(3.7, 2.3), mk(3.6, 2.4), mk(5.0, 1.0)]);
    expect(out.framesUsed).toBeGreaterThanOrEqual(3);
    expect(out.bordersMm.L).toBeGreaterThan(3.4);
    expect(out.bordersMm.L).toBeLessThan(3.8);
    expect(out.status).toBe("OK");
  });
});

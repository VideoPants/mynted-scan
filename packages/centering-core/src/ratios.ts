import type { AxisRatio, BordersMm } from "./types.js";

/** Axis ratio: max(a,b)/(a+b)*100. No rounding for comparisons. */
export function axisRatio(
  a: number,
  b: number,
  widerWhenA: "L" | "T",
  widerWhenB: "R" | "B",
): AxisRatio {
  const sum = a + b;
  if (sum <= 0) {
    return { larger: 50, smaller: 50, wider: widerWhenA, raw: 50 };
  }
  const rawLarger = (Math.max(a, b) / sum) * 100;
  const rawSmaller = 100 - rawLarger;
  const wider = a >= b ? widerWhenA : widerWhenB;
  return {
    larger: roundDisplay(rawLarger),
    smaller: roundDisplay(rawSmaller),
    wider,
    raw: rawLarger,
  };
}

export function lrRatio(borders: BordersMm): AxisRatio {
  return axisRatio(borders.L, borders.R, "L", "R");
}

export function tbRatio(borders: BordersMm): AxisRatio {
  return axisRatio(borders.T, borders.B, "T", "B");
}

/** Worse (larger) raw ratio on a face decides the face ceiling. */
export function worseAxisRaw(lr: AxisRatio, tb: AxisRatio): number {
  return Math.max(lr.raw, tb.raw);
}

export function roundDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatRatioPair(ratio: AxisRatio): string {
  if (ratio.wider === "L" || ratio.wider === "T") {
    return `${ratio.larger.toFixed(1)}/${ratio.smaller.toFixed(1)}`;
  }
  return `${ratio.smaller.toFixed(1)}/${ratio.larger.toFixed(1)}`;
}
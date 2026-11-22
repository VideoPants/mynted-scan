/** Pure geometry helpers for subpixel edges and line fitting (no OpenCV). */

export interface Point {
  x: number;
  y: number;
}

export interface LineEq {
  a: number;
  b: number;
  c: number;
}

export function lineFromPoints(p1: Point, p2: Point): LineEq {
  const a = p1.y - p2.y;
  const b = p2.x - p1.x;
  const c = p1.x * p2.y - p2.x * p1.y;
  return { a, b, c };
}

export function intersectLines(l1: LineEq, l2: LineEq): Point | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-9) return null;
  return {
    x: (l1.b * l2.c - l2.b * l1.c) / det,
    y: (l2.a * l1.c - l1.a * l2.c) / det,
  };
}

/** Parabolic peak fit around discrete max for subpixel localization. */
export function subpixelPeak(samples: number[], peakIndex: number): number {
  if (peakIndex <= 0 || peakIndex >= samples.length - 1) return peakIndex;
  const y0 = samples[peakIndex - 1]!;
  const y1 = samples[peakIndex]!;
  const y2 = samples[peakIndex + 1]!;
  const denom = 2 * (2 * y1 - y0 - y2);
  if (Math.abs(denom) < 1e-9) return peakIndex;
  const delta = (y0 - y2) / denom;
  return peakIndex + delta;
}

export function perpendicularDistance(point: Point, line: LineEq): number {
  const norm = Math.hypot(line.a, line.b);
  if (norm < 1e-9) return 0;
  return Math.abs(line.a * point.x + line.b * point.y + line.c) / norm;
}

/** RANSAC line fit; returns inlier line equation. */
export function ransacLine(
  points: Point[],
  iterations = 80,
  threshold = 1.5,
  seed = 42,
): { line: LineEq; inliers: Point[] } {
  if (points.length < 2) {
    return { line: { a: 0, b: 1, c: 0 }, inliers: points };
  }

  let rng = seed;
  const next = () => {
    rng = (rng * 1664525 + 1013904223) % 4294967296;
    return rng / 4294967296;
  };

  let bestInliers: Point[] = [];
  let bestLine = lineFromPoints(points[0]!, points[1] ?? points[0]!);

  for (let i = 0; i < iterations; i++) {
    const i1 = Math.floor(next() * points.length);
    let i2 = Math.floor(next() * points.length);
    if (i2 === i1) i2 = (i2 + 1) % points.length;
    const line = lineFromPoints(points[i1]!, points[i2]!);
    const inliers = points.filter((p) => perpendicularDistance(p, line) <= threshold);
    if (inliers.length > bestInliers.length) {
      bestInliers = inliers;
      bestLine = line;
    }
  }

  if (bestInliers.length >= 2) {
    bestLine = leastSquaresLine(bestInliers);
  }
  return { line: bestLine, inliers: bestInliers };
}

export function leastSquaresLine(points: Point[]): LineEq {
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  let sumYY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXX += p.x * p.x;
    sumXY += p.x * p.y;
    sumYY += p.y * p.y;
  }
  const varX = sumXX - (sumX * sumX) / n;
  const varY = sumYY - (sumY * sumY) / n;

  if (Math.abs(varX) >= Math.abs(varY)) {
    const slope = (sumXY - (sumX * sumY) / n) / (varX || 1);
    const intercept = sumY / n - slope * (sumX / n);
    // y = slope*x + intercept  =>  slope*x - y + intercept = 0
    return { a: slope, b: -1, c: intercept };
  }
  const slope = (sumXY - (sumX * sumY) / n) / (varY || 1);
  const intercept = sumX / n - slope * (sumY / n);
  // x = slope*y + intercept => x - slope*y - intercept = 0
  return { a: 1, b: -slope, c: -intercept };
}

export function mmBetweenParallel(
  outer: LineEq,
  inner: LineEq,
  pxPerMm: number,
): number {
  const norm = Math.hypot(outer.a, outer.b) || 1;
  // Approximate distance using c difference when lines are nearly parallel
  const sample: Point = { x: 0, y: 0 };
  if (Math.abs(outer.b) > Math.abs(outer.a)) {
    sample.x = 100;
    sample.y = -(outer.a * sample.x + outer.c) / outer.b;
  } else {
    sample.y = 100;
    sample.x = -(outer.b * sample.y + outer.c) / outer.a;
  }
  return perpendicularDistance(sample, inner) / pxPerMm / (norm / Math.hypot(outer.a, outer.b));
}

export function nudgeLine(
  line: { x1: number; y1: number; x2: number; y2: number },
  axis: "horizontal" | "vertical",
  deltaMm: number,
  pxPerMm: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const d = deltaMm * pxPerMm;
  if (axis === "horizontal") {
    return { x1: line.x1, y1: line.y1 + d, x2: line.x2, y2: line.y2 + d };
  }
  return { x1: line.x1 + d, y1: line.y1, x2: line.x2 + d, y2: line.y2 };
}
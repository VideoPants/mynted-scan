/**
 * Full centering pipeline on RGBA image pixels (OpenCV.js / opencv-js).
 * Mirrors services/measure-py/app/measure.py.
 */

import { faceFromBorders, residualFromBorders } from "./measure.js";
import { subpixelPeak } from "./geometry.js";
import {
  ALGORITHM_VERSION,
  DEFAULT_POKEMON_PROFILE,
  type BordersMm,
  type CardProfile,
  type FaceSide,
  type FaceStatus,
} from "./types.js";
import type { FaceReport } from "./report.js";

/** Minimal OpenCV.js surface used by this pipeline. */
export type OpenCvLike = {
  Mat: new () => CvMat;
  matFromImageData: (img: { data: Uint8ClampedArray; width: number; height: number }) => CvMat;
  cvtColor: (src: CvMat, dst: CvMat, code: number) => void;
  GaussianBlur: (src: CvMat, dst: CvMat, ksize: { width: number; height: number }, sigma: number) => void;
  Canny: (src: CvMat, dst: CvMat, t1: number, t2: number) => void;
  findContours: (
    src: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number,
  ) => void;
  contourArea: (c: CvMat) => number;
  arcLength: (c: CvMat, closed: boolean) => number;
  approxPolyDP: (c: CvMat, approx: CvMat, epsilon: number, closed: boolean) => void;
  isContourConvex: (c: CvMat) => boolean;
  convexHull: (c: CvMat, hull: CvMat) => void;
  boundingRect: (c: CvMat) => { x: number; y: number; width: number; height: number };
  getPerspectiveTransform: (src: CvMat, dst: CvMat) => CvMat;
  warpPerspective: (
    src: CvMat,
    dst: CvMat,
    M: CvMat,
    dsize: { width: number; height: number },
  ) => void;
  matFromArray: (rows: number, cols: number, type: number, array: number[]) => CvMat;
  MatVector: new () => CvMatVector;
  COLOR_RGBA2GRAY: number;
  COLOR_RGB2GRAY: number;
  RETR_EXTERNAL: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_32FC2: number;
};

type DetectQuadResult =
  | { ok: true; flat: number[]; fromSlab?: boolean }
  | { ok: false; reason: "SLAB" };

type CvMat = {
  rows: number;
  cols: number;
  data: Uint8Array;
  data32F: Float32Array;
  delete: () => void;
  ucharPtr: (row: number, col?: number) => Uint8Array;
};

type CvMatVector = {
  size: () => number;
  get: (i: number) => CvMat;
  delete: () => void;
};

export interface PixelImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface MeasureImageOptions {
  face: FaceSide;
  captureSource?: FaceReport["captureSource"];
  framesUsed?: number;
  profile?: CardProfile;
  /** When true, OpenCV was loaded for this run. */
  openCvLoaded: boolean;
}

export class MeasureError extends Error {
  constructor(
    public readonly code: "noCard" | "tooSmall" | "opencv_required" | "measure_failed",
    message?: string,
  ) {
    super(message || code);
    this.name = "MeasureError";
  }
}

export function measureImagePixels(
  cv: OpenCvLike,
  image: PixelImage,
  opts: MeasureImageOptions,
): FaceReport {
  if (!opts.openCvLoaded) {
    throw new MeasureError("opencv_required", "OpenCV.js is required for measurement");
  }
  const profile = opts.profile ?? DEFAULT_POKEMON_PROFILE;
  const { width, height } = image;
  if (width < 200 || height < 200) {
    throw new MeasureError("tooSmall");
  }

  const aspect = width / Math.max(height, 1);
  const target = profile.widthMm / profile.heightMm;
  if (aspect < target * 0.55 || aspect > target * 1.8) {
    throw new MeasureError("noCard");
  }

  const src = cv.matFromImageData(image);
  const gray = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const detected = detectQuad(cv, gray);
    if (!detected) {
      throw new MeasureError("noCard");
    }
    if (!detected.ok) {
      return faceFromBorders(
        {
          face: opts.face,
          borders: { L: 0, R: 0, T: 0, B: 0 },
          status: "UNSUPPORTED",
          confidence: 0.1,
          framesUsed: opts.framesUsed ?? 1,
          captureSource: opts.captureSource ?? "UPLOAD",
          uncertaintyPp: { lr: 2.0, tb: 2.0 },
          quality: {
            openCvLoaded: true,
            width,
            height,
            algorithmVersion: ALGORITHM_VERSION,
            reason: detected.reason,
          },
        },
        profile,
      );
    }
    const quad = detected.flat;

    const canonicalW = Math.round(profile.widthMm * profile.pxPerMm);
    const canonicalH = Math.round(profile.heightMm * profile.pxPerMm);
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      quad[0]!,
      quad[1]!,
      quad[2]!,
      quad[3]!,
      quad[4]!,
      quad[5]!,
      quad[6]!,
      quad[7]!,
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      canonicalW - 1,
      0,
      canonicalW - 1,
      canonicalH - 1,
      0,
      canonicalH - 1,
    ]);
    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    const rectified = new cv.Mat();
    cv.warpPerspective(src, rectified, M, { width: canonicalW, height: canonicalH });
    srcTri.delete();
    dstTri.delete();
    M.delete();

    const grayR = new cv.Mat();
    cv.cvtColor(rectified, grayR, cv.COLOR_RGBA2GRAY);
    const inner = innerBorders(grayR, profile);
    grayR.delete();

    // Nested-from-slab that still fails measurement → honest SLAB, not a bogus border code.
    let { borders, status, confidence, lines, residualLr, residualTb, reason } = inner;
    if (detected.fromSlab && status === "UNSUPPORTED") {
      reason = "SLAB";
      borders = { L: 0, R: 0, T: 0, B: 0 };
      confidence = 0.1;
      residualLr = 2.0;
      residualTb = 2.0;
    }

    // Keep a small JPEG-ish data URL optional via caller; pipeline returns lines only.
    const report = faceFromBorders(
      {
        face: opts.face,
        borders,
        status,
        confidence,
        framesUsed: opts.framesUsed ?? 1,
        captureSource: opts.captureSource ?? "UPLOAD",
        uncertaintyPp: {
          lr: residualLr,
          tb: residualTb,
        },
        lines,
        quality: {
          openCvLoaded: true,
          width,
          height,
          algorithmVersion: ALGORITHM_VERSION,
          rectifiedWidth: canonicalW,
          rectifiedHeight: canonicalH,
          ...(reason ? { reason } : {}),
        },
      },
      profile,
    );

    // Attach rectified RGBA for overlays (caller may encode).
    (report as FaceReport & { rectifiedRgba?: PixelImage }).rectifiedRgba = {
      data: new Uint8ClampedArray(rectified.data),
      width: rectified.cols,
      height: rectified.rows,
    };
    rectified.delete();
    return report;
  } finally {
    src.delete();
    gray.delete();
  }
}

/** Portrait-normalized aspect (≤1) so swapped TL/TR edge metrics still score. */
function portraitAspect(w: number, h: number): number {
  const a = w / Math.max(h, 1);
  return a <= 1 ? a : 1 / a;
}

function aspectScore(w: number, h: number, target: number): number {
  if (w < 8 || h < 8) return Infinity;
  return Math.abs(Math.log(portraitAspect(w, h) / target));
}

/** PSA slab outer ~80×133 mm (aspect ≈0.60) vs card 63/88. */
const SLAB_ASPECT = 80 / 133;
const CARD_ASPECT_FAR = 0.12;

function quadMetrics(flat: number[]): { qw: number; qh: number; area: number; cx: number; cy: number } {
  const qw = Math.hypot(flat[2]! - flat[0]!, flat[3]! - flat[1]!);
  const qh = Math.hypot(flat[6]! - flat[0]!, flat[7]! - flat[1]!);
  const cx = (flat[0]! + flat[2]! + flat[4]! + flat[6]!) / 4;
  const cy = (flat[1]! + flat[3]! + flat[5]! + flat[7]!) / 4;
  return { qw, qh, area: qw * qh, cx, cy };
}

function looksLikeSlab(qw: number, qh: number, targetAspect: number): boolean {
  const cardScore = aspectScore(qw, qh, targetAspect);
  const slabScore = aspectScore(qw, qh, SLAB_ASPECT);
  return cardScore > CARD_ASPECT_FAR && slabScore < cardScore;
}

function hasLabelBand(gray: CvMat, flat: number[]): boolean {
  const xs = [flat[0]!, flat[2]!, flat[4]!, flat[6]!];
  const ys = [flat[1]!, flat[3]!, flat[5]!, flat[7]!];
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(gray.cols - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(gray.rows - 1, Math.ceil(Math.max(...ys)));
  const bandH = Math.max(4, Math.floor((maxY - minY) * 0.12));
  let sum = 0;
  let n = 0;
  for (let y = minY; y < minY + bandH; y += 2) {
    for (let x = minX; x <= maxX; x += 3) {
      sum += grayAt(gray, y, x);
      n++;
    }
  }
  if (n < 10) return false;
  const topMean = sum / n;
  // Label band is typically brighter/whiter than the plastic below it.
  let below = 0;
  let bn = 0;
  const belowY0 = minY + bandH + 4;
  const belowY1 = Math.min(maxY, belowY0 + bandH);
  for (let y = belowY0; y < belowY1; y += 2) {
    for (let x = minX; x <= maxX; x += 3) {
      below += grayAt(gray, y, x);
      bn++;
    }
  }
  if (bn < 10) return false;
  return topMean > 140 && topMean - below / bn > 25;
}

function pointInOuterBBox(flat: number[], x: number, y: number): boolean {
  const xs = [flat[0]!, flat[2]!, flat[4]!, flat[6]!];
  const ys = [flat[1]!, flat[3]!, flat[5]!, flat[7]!];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function findNestedCardQuad(
  cands: { flat: number[]; area: number; qw: number; qh: number }[],
  outer: number[],
  targetAspect: number,
): number[] | null {
  const outerM = quadMetrics(outer);
  let best: { score: number; flat: number[] } | null = null;
  for (const c of cands) {
    if (c.area < outerM.area * 0.2 || c.area > outerM.area * 0.85) continue;
    const { cx, cy } = quadMetrics(c.flat);
    if (!pointInOuterBBox(outer, cx, cy)) continue;
    const score = aspectScore(c.qw, c.qh, targetAspect);
    if (score > 0.25) continue;
    if (!best || score < best.score) best = { score, flat: c.flat };
  }
  return best ? shrinkQuadFlat(best.flat, 1) : null;
}

function detectQuad(cv: OpenCvLike, gray: CvMat): DetectQuadResult | null {
  const h = gray.rows;
  const w = gray.cols;
  const imgArea = h * w;
  const targetAspect = 63 / 88;
  const fillFallback = [0, 0, w - 1, 0, w - 1, h - 1, 0, h - 1];

  // Bright-region bounding box (card on dark bg) — preferred outer estimate.
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let bright = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (grayAt(gray, y, x) > 50) {
        bright++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const brightFrac = (bright * 4) / imgArea;
  let brightBBoxQuad: number[] | null = null;
  if (bright > 100 && brightFrac > 0.08) {
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    // Card nearly fills the frame — use image bounds (already rectified / clean).
    if (bw * bh > imgArea * 0.9 || (minX <= 2 && minY <= 2 && maxX >= w - 3 && maxY >= h - 3)) {
      return { ok: true, flat: fillFallback };
    }
    // Bright AABB is only safe when the card nearly fills that box (little
    // perspective). Otherwise background corners survive the warp.
    const bboxArea = bw * bh;
    const fillInBbox = bboxArea > 0 ? (bright * 4) / bboxArea : 0;
    if (fillInBbox > 0.85) {
      brightBBoxQuad = shrinkQuadFlat([minX, minY, maxX, minY, maxX, maxY, minX, maxY], 1);
    }
  }

  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.GaussianBlur(gray, blur, { width: 5, height: 5 }, 0);
    cv.Canny(blur, edges, 40, 140);
    // LIST captures nested card contours inside a slab outer.
    const mode = cv.RETR_LIST ?? cv.RETR_EXTERNAL;
    cv.findContours(edges, contours, hierarchy, mode, cv.CHAIN_APPROX_SIMPLE);
    const n = contours.size();
    if (n === 0) {
      return { ok: true, flat: brightBBoxQuad ?? fillFallback };
    }

    type Cand = { score: number; flat: number[]; area: number; qw: number; qh: number };
    const cands: Cand[] = [];

    for (let i = 0; i < n; i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area < imgArea * 0.04 || area > imgArea * 0.98) continue;
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
      let flat: number[] | null = null;
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        flat = orderQuadFlat(matToPoints(approx));
      } else {
        const hull = new cv.Mat();
        cv.convexHull(cnt, hull);
        const approx2 = new cv.Mat();
        cv.approxPolyDP(hull, approx2, 0.02 * cv.arcLength(hull, true), true);
        if (approx2.rows === 4) {
          flat = orderQuadFlat(matToPoints(approx2));
        }
        hull.delete();
        approx2.delete();
      }
      approx.delete();
      if (!flat) continue;
      const { qw, qh, area: qArea } = quadMetrics(flat);
      // Prefer larger cards with Pokémon-like aspect; avoid tiny inner-art quads.
      const score = aspectScore(qw, qh, targetAspect) - qArea / imgArea;
      cands.push({ score, flat, area: qArea, qw, qh });
    }

    cands.sort((a, b) => a.score - b.score);
    let chosen: number[] | null = null;
    if (cands.length > 0) {
      // Prefer largest outer when it looks like a PSA slab; search for nested card.
      const byArea = [...cands].sort((a, b) => b.area - a.area);
      const largest = byArea[0]!;
      const largestSlabish =
        looksLikeSlab(largest.qw, largest.qh, targetAspect) ||
        hasLabelBand(gray, largest.flat);
      let fromSlab = false;
      if (largestSlabish) {
        const nested = findNestedCardQuad(cands, largest.flat, targetAspect);
        if (nested) {
          chosen = nested;
          fromSlab = true;
        } else {
          return { ok: false, reason: "SLAB" };
        }
      } else {
        const best = cands[0]!;
        const bestSlabish =
          looksLikeSlab(best.qw, best.qh, targetAspect) || hasLabelBand(gray, best.flat);
        if (bestSlabish) {
          const nested = findNestedCardQuad(cands, best.flat, targetAspect);
          if (nested) {
            chosen = nested;
            fromSlab = true;
          } else {
            return { ok: false, reason: "SLAB" };
          }
        } else {
          chosen = shrinkQuadFlat(best.flat, 1);
        }
      }
      if (chosen) {
        return { ok: true, flat: chosen, fromSlab };
      }
    }

    if (brightBBoxQuad) {
      const bm = quadMetrics(brightBBoxQuad);
      if (looksLikeSlab(bm.qw, bm.qh, targetAspect) || hasLabelBand(gray, brightBBoxQuad)) {
        const nested = findNestedCardQuad(cands, brightBBoxQuad, targetAspect);
        if (nested) return { ok: true, flat: nested, fromSlab: true };
        return { ok: false, reason: "SLAB" };
      }
      if (aspectScore(bm.qw, bm.qh, targetAspect) < 0.35) {
        return { ok: true, flat: brightBBoxQuad };
      }
    }

    const areas: { i: number; area: number }[] = [];
    for (let i = 0; i < n; i++) {
      areas.push({ i, area: cv.contourArea(contours.get(i)) });
    }
    areas.sort((a, b) => b.area - a.area);
    const best = contours.get(areas[0]!.i);
    const rect = cv.boundingRect(best);
    if (rect.width * rect.height > imgArea * 0.9) {
      return { ok: true, flat: fillFallback };
    }
    return {
      ok: true,
      flat: shrinkQuadFlat(
        [
          rect.x,
          rect.y,
          rect.x + rect.width - 1,
          rect.y,
          rect.x + rect.width - 1,
          rect.y + rect.height - 1,
          rect.x,
          rect.y + rect.height - 1,
        ],
        1,
      ),
    };
  } finally {
    blur.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}

/** Pull corners ~px toward centroid so background does not survive the warp. */
function shrinkQuadFlat(flat: number[], px: number): number[] {
  const cx = (flat[0]! + flat[2]! + flat[4]! + flat[6]!) / 4;
  const cy = (flat[1]! + flat[3]! + flat[5]! + flat[7]!) / 4;
  const out = flat.slice();
  for (let i = 0; i < 4; i++) {
    const x = out[i * 2]!;
    const y = out[i * 2 + 1]!;
    const dx = cx - x;
    const dy = cy - y;
    const len = Math.hypot(dx, dy) || 1;
    out[i * 2] = x + (dx / len) * px;
    out[i * 2 + 1] = y + (dy / len) * px;
  }
  return out;
}

function matToPoints(mat: CvMat): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  // approxPolyDP stores as Nx1 CV_32SC2 or similar; data is int32 pairs
  const data = mat.data;
  const view = new Int32Array(data.buffer, data.byteOffset, mat.rows * 2);
  for (let i = 0; i < mat.rows; i++) {
    pts.push({ x: view[i * 2]!, y: view[i * 2 + 1]! });
  }
  return pts;
}

function orderQuadFlat(pts: { x: number; y: number }[]): number[] {
  const s = pts.map((p) => p.x + p.y);
  const diff = pts.map((p) => p.x - p.y);
  const tl = pts[s.indexOf(Math.min(...s))]!;
  const br = pts[s.indexOf(Math.max(...s))]!;
  // tr has large x-y; bl has small x-y
  const tr = pts[diff.indexOf(Math.max(...diff))]!;
  const bl = pts[diff.indexOf(Math.min(...diff))]!;
  return [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y];
}

function grayAt(gray: CvMat & { ucharAt?: (row: number, col: number) => number }, y: number, x: number): number {
  const yi = Math.max(0, Math.min(gray.rows - 1, y | 0));
  const xi = Math.max(0, Math.min(gray.cols - 1, x | 0));
  if (typeof gray.ucharAt === "function") {
    return gray.ucharAt(yi, xi);
  }
  return gray.ucharPtr(yi)[xi]!;
}

type SideMeasure = { widthPx: number; iqrPx: number; n: number };

const BORDER_MIN_MM = 1.0;
const BORDER_MAX_MM = 6.0;
const OK_MAX_RESIDUAL_PP = 1.5;

function borderWidthPx(
  gray: CvMat,
  side: "L" | "R" | "T" | "B",
  skip: number,
  stations: number,
  pxPerMm: number,
): SideMeasure | null {
  const h = gray.rows;
  const w = gray.cols;
  const offsetPx = Math.max(10, Math.round(0.75 * pxPerMm));
  const searchMm = 8;
  const searchPx = Math.round(searchMm * pxPerMm);
  const widths: number[] = [];

  const sampleSide = (along: number, dim: number, inward: (i: number) => number) => {
    const maxI = Math.min(Math.floor(dim / 2), offsetPx + searchPx);
    const segment: number[] = [];
    for (let i = offsetPx; i < maxI; i++) {
      segment.push(inward(i));
    }
    if (segment.length < 4) return;
    const peak = firstStrongEdge(segment);
    if (peak == null) return;
    widths.push(offsetPx + peak);
  };

  if (side === "L" || side === "R") {
    const y0 = Math.floor(h * skip);
    const y1 = Math.floor(h * (1 - skip));
    for (let s = 0; s < stations; s++) {
      const y = Math.round(y0 + ((y1 - y0) * s) / Math.max(1, stations - 1));
      sampleSide(y, w, (i) => grayAt(gray, y, side === "L" ? i : w - 1 - i));
    }
  } else {
    const x0 = Math.floor(w * skip);
    const x1 = Math.floor(w * (1 - skip));
    for (let s = 0; s < stations; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / Math.max(1, stations - 1));
      sampleSide(x, h, (i) => grayAt(gray, side === "T" ? i : h - 1 - i, x));
    }
  }

  if (widths.length < Math.max(8, Math.floor(stations / 4))) return null;
  const robust = robustMedianIqr(widths);
  if (robust == null) return null;
  return { widthPx: robust.median, iqrPx: robust.iqr, n: robust.n };
}

/** First strong local peak (not global max) inside the search window. */
function firstStrongEdge(segment: number[]): number | null {
  const grad = absGradient(segment);
  const maxG = Math.max(...grad);
  if (maxG < 4) return null;
  const threshold = Math.max(4, 0.4 * maxG);
  for (let i = 1; i < grad.length - 1; i++) {
    const g = grad[i]!;
    if (g < threshold) continue;
    if (g >= grad[i - 1]! && g >= grad[i + 1]!) {
      return subpixelPeak(grad, i);
    }
  }
  // Fallback: first index at/above threshold
  for (let i = 0; i < grad.length; i++) {
    if (grad[i]! >= threshold) return subpixelPeak(grad, i);
  }
  return null;
}

function absGradient(samples: number[]): number[] {
  const g: number[] = new Array(samples.length).fill(0);
  for (let i = 1; i < samples.length - 1; i++) {
    g[i] = Math.abs((samples[i + 1]! - samples[i - 1]!) / 2);
  }
  if (samples.length > 1) {
    g[0] = Math.abs(samples[1]! - samples[0]!);
    g[samples.length - 1] = Math.abs(samples[samples.length - 1]! - samples[samples.length - 2]!);
  }
  return g;
}

/** Median after dropping stations outside median ± 1.5×IQR; returns median + IQR of kept. */
function robustMedianIqr(values: number[]): { median: number; iqr: number; n: number } | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr0 = Math.max(0, q3 - q1);
  const med0 = percentile(sorted, 0.5);
  const lo = med0 - 1.5 * iqr0;
  const hi = med0 + 1.5 * iqr0;
  const kept = sorted.filter((v) => v >= lo && v <= hi);
  const use = kept.length >= Math.max(4, Math.floor(sorted.length / 3)) ? kept : sorted;
  const q1k = percentile(use, 0.25);
  const q3k = percentile(use, 0.75);
  return { median: percentile(use, 0.5), iqr: Math.max(0, q3k - q1k), n: use.length };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const t = idx - lo;
  return sorted[lo]! * (1 - t) + sorted[hi]! * t;
}

function confidenceFromSpread(residualLr: number, residualTb: number, stationOk: boolean): number {
  if (!stationOk) return 0.15;
  const worst = Math.max(residualLr, residualTb);
  if (worst > OK_MAX_RESIDUAL_PP) return Math.max(0.25, 0.7 - (worst - OK_MAX_RESIDUAL_PP) * 0.15);
  return Math.max(0.55, Math.min(0.95, 0.95 - worst * 0.2));
}

function innerBorders(
  gray: CvMat,
  profile: CardProfile,
): {
  borders: BordersMm;
  status: FaceStatus;
  confidence: number;
  lines: NonNullable<FaceReport["lines"]>;
  residualLr: number;
  residualTb: number;
  reason?: string;
} {
  const h = gray.rows;
  const w = gray.cols;
  const px = profile.pxPerMm;
  const stations = profile.stationsPerEdge;
  const skip = profile.cornerSkipFraction;

  const measured = {
    L: borderWidthPx(gray, "L", skip, stations, px),
    R: borderWidthPx(gray, "R", skip, stations, px),
    T: borderWidthPx(gray, "T", skip, stations, px),
    B: borderWidthPx(gray, "B", skip, stations, px),
  };

  let borders: BordersMm;
  let status: FaceStatus;
  let confidence: number;
  let residualLr: number;
  let residualTb: number;
  let reason: string | undefined;

  if (Object.values(measured).some((v) => v == null)) {
    borders = { L: 0, R: 0, T: 0, B: 0 };
    status = "UNSUPPORTED";
    confidence = 0.15;
    residualLr = 2.0;
    residualTb = 2.0;
    reason = "NO_INNER_EDGE";
  } else {
    borders = {
      L: measured.L!.widthPx / px,
      R: measured.R!.widthPx / px,
      T: measured.T!.widthPx / px,
      B: measured.B!.widthPx / px,
    };
    // Uncertainty of the median ≈ (IQR/1.349) / sqrt(n), not the raw station IQR.
    const sideUncMm = (m: SideMeasure) =>
      m.iqrPx / 1.349 / Math.sqrt(Math.max(8, m.n)) / px;
    const uL = sideUncMm(measured.L!);
    const uR = sideUncMm(measured.R!);
    const uT = sideUncMm(measured.T!);
    const uB = sideUncMm(measured.B!);
    residualLr = residualFromBorders(borders.L, borders.R, uL, uR);
    residualTb = residualFromBorders(borders.T, borders.B, uT, uB);

    const vals = Object.values(borders);
    const outOfRange = vals.some((v) => v < BORDER_MIN_MM || v > BORDER_MAX_MM);
    if (outOfRange) {
      status = "UNSUPPORTED";
      reason = "BORDER_OUT_OF_RANGE";
      confidence = 0.2;
    } else {
      const worst = Math.max(residualLr, residualTb);
      if (worst > OK_MAX_RESIDUAL_PP) {
        status = "LOW_CONFIDENCE";
        confidence = confidenceFromSpread(residualLr, residualTb, true);
      } else {
        status = "OK";
        confidence = confidenceFromSpread(residualLr, residualTb, true);
      }
    }
  }

  const lines = {
    outer: {
      L: { x1: 0, y1: 0, x2: 0, y2: h },
      R: { x1: w, y1: 0, x2: w, y2: h },
      T: { x1: 0, y1: 0, x2: w, y2: 0 },
      B: { x1: 0, y1: h, x2: w, y2: h },
    },
    inner: {
      L: { x1: borders.L * px, y1: 0, x2: borders.L * px, y2: h },
      R: { x1: w - borders.R * px, y1: 0, x2: w - borders.R * px, y2: h },
      T: { x1: 0, y1: borders.T * px, x2: w, y2: borders.T * px },
      B: { x1: 0, y1: h - borders.B * px, x2: w, y2: h - borders.B * px },
    },
  };

  return { borders, status, confidence, lines, residualLr, residualTb, reason };
}

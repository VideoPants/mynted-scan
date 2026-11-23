/**
 * Full centering pipeline on RGBA image pixels (OpenCV.js / opencv-js).
 * Mirrors services/measure-py/app/measure.py.
 */

import { faceFromBorders } from "./measure.js";
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
  CHAIN_APPROX_SIMPLE: number;
  CV_32FC2: number;
};

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
    const quad = detectQuad(cv, gray);
    if (!quad) {
      throw new MeasureError("noCard");
    }

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
    const { borders, status, confidence, lines, residualPp } = innerBorders(
      grayR,
      profile,
    );
    grayR.delete();

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
          lr: residualPp,
          tb: residualPp,
        },
        lines,
        quality: {
          openCvLoaded: true,
          width,
          height,
          algorithmVersion: ALGORITHM_VERSION,
          rectifiedWidth: canonicalW,
          rectifiedHeight: canonicalH,
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

function aspectScore(w: number, h: number, target: number): number {
  if (w < 8 || h < 8) return Infinity;
  const a = w / h;
  return Math.abs(Math.log(a / target));
}

function detectQuad(cv: OpenCvLike, gray: CvMat): number[] | null {
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
  if (bright > 100 && brightFrac > 0.08) {
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    // Card nearly fills the frame — use image bounds (already rectified / clean).
    if (bw * bh > imgArea * 0.9 || (minX <= 2 && minY <= 2 && maxX >= w - 3 && maxY >= h - 3)) {
      return fillFallback;
    }
    if (aspectScore(bw, bh, targetAspect) < 0.35) {
      return [minX, minY, maxX, minY, maxX, maxY, minX, maxY];
    }
  }

  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.GaussianBlur(gray, blur, { width: 5, height: 5 }, 0);
    cv.Canny(blur, edges, 40, 140);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const n = contours.size();
    if (n === 0) {
      return fillFallback;
    }

    type Cand = { score: number; flat: number[] };
    const cands: Cand[] = [];

    for (let i = 0; i < n; i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area < imgArea * 0.08 || area > imgArea * 0.98) continue;
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
      const qw = Math.hypot(flat[2]! - flat[0]!, flat[3]! - flat[1]!);
      const qh = Math.hypot(flat[6]! - flat[0]!, flat[7]! - flat[1]!);
      // Prefer larger cards with Pokémon-like aspect; avoid tiny inner-art quads.
      const score = aspectScore(qw, qh, targetAspect) - area / imgArea;
      cands.push({ score, flat });
    }

    cands.sort((a, b) => a.score - b.score);
    if (cands.length > 0) {
      return cands[0]!.flat;
    }

    const areas: { i: number; area: number }[] = [];
    for (let i = 0; i < n; i++) {
      areas.push({ i, area: cv.contourArea(contours.get(i)) });
    }
    areas.sort((a, b) => b.area - a.area);
    const best = contours.get(areas[0]!.i);
    const rect = cv.boundingRect(best);
    if (rect.width * rect.height > imgArea * 0.9) {
      return fillFallback;
    }
    return [
      rect.x,
      rect.y,
      rect.x + rect.width - 1,
      rect.y,
      rect.x + rect.width - 1,
      rect.y + rect.height - 1,
      rect.x,
      rect.y + rect.height - 1,
    ];
  } finally {
    blur.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
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
  const tr = pts[diff.indexOf(Math.min(...diff))]!;
  const bl = pts[diff.indexOf(Math.max(...diff))]!;
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

function borderWidthPx(
  gray: CvMat,
  side: "L" | "R" | "T" | "B",
  skip: number,
  stations: number,
): number | null {
  const h = gray.rows;
  const w = gray.cols;
  const widths: number[] = [];

  if (side === "L" || side === "R") {
    const y0 = Math.floor(h * skip);
    const y1 = Math.floor(h * (1 - skip));
    for (let s = 0; s < stations; s++) {
      const y = Math.round(y0 + ((y1 - y0) * s) / Math.max(1, stations - 1));
      const edge = Math.min(Math.floor(w / 2), Math.max(8, Math.floor(w / 3)));
      const segment: number[] = [];
      for (let i = 0; i < edge; i++) {
        const x = side === "L" ? i : w - 1 - i;
        segment.push(grayAt(gray, y, x));
      }
      const grad = absGradient(segment);
      const maxG = Math.max(...grad);
      if (maxG < 4) continue;
      const peak = grad.indexOf(maxG);
      widths.push(subpixelPeak(grad, peak));
    }
  } else {
    const x0 = Math.floor(w * skip);
    const x1 = Math.floor(w * (1 - skip));
    for (let s = 0; s < stations; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / Math.max(1, stations - 1));
      const edge = Math.min(Math.floor(h / 2), Math.max(8, Math.floor(h / 3)));
      const segment: number[] = [];
      for (let i = 0; i < edge; i++) {
        const y = side === "T" ? i : h - 1 - i;
        segment.push(grayAt(gray, y, x));
      }
      const grad = absGradient(segment);
      const maxG = Math.max(...grad);
      if (maxG < 4) continue;
      const peak = grad.indexOf(maxG);
      widths.push(subpixelPeak(grad, peak));
    }
  }

  if (widths.length < Math.max(8, Math.floor(stations / 4))) return null;
  widths.sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)]!;
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

function innerBorders(
  gray: CvMat,
  profile: CardProfile,
): {
  borders: BordersMm;
  status: FaceStatus;
  confidence: number;
  lines: NonNullable<FaceReport["lines"]>;
  residualPp: number;
} {
  const h = gray.rows;
  const w = gray.cols;
  const px = profile.pxPerMm;
  const stations = profile.stationsPerEdge;
  const skip = profile.cornerSkipFraction;

  const measured = {
    L: borderWidthPx(gray, "L", skip, stations),
    R: borderWidthPx(gray, "R", skip, stations),
    T: borderWidthPx(gray, "T", skip, stations),
    B: borderWidthPx(gray, "B", skip, stations),
  };

  let borders: BordersMm;
  let status: FaceStatus;
  let confidence: number;
  let residualPp: number;

  if (Object.values(measured).some((v) => v == null)) {
    borders = { L: 0, R: 0, T: 0, B: 0 };
    status = "UNSUPPORTED";
    confidence = 0.15;
    residualPp = 2.0;
  } else {
    borders = {
      L: measured.L! / px,
      R: measured.R! / px,
      T: measured.T! / px,
      B: measured.B! / px,
    };
    const vals = Object.values(borders);
    if (Math.min(...vals) < 0.15) {
      status = "UNSUPPORTED";
      confidence = 0.2;
      residualPp = 1.5;
    } else if (Math.max(...vals) > 10) {
      status = "LOW_CONFIDENCE";
      confidence = 0.45;
      residualPp = 1.0;
    } else {
      status = "OK";
      confidence = 0.88;
      // Residual band from border asymmetry noise (conservative until burst).
      const lrSpread = Math.abs(borders.L - borders.R);
      const tbSpread = Math.abs(borders.T - borders.B);
      residualPp = Math.min(1.2, Math.max(0.35, ((lrSpread + tbSpread) / 2) * 0.15 + 0.35));
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

  return { borders, status, confidence, lines, residualPp };
}

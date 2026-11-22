/**
 * Browser/Node measurement pipeline entry.
 * Full OpenCV path runs in the classic worker; this module provides
 * the pure-TS path used when borders/lines are already known, plus
 * a classical-detection shaped API for parity tests.
 */

import { faceFromBorders, type MeasureBordersInput } from "./measure.js";
import type { FaceReport } from "./report.js";
import {
  DEFAULT_POKEMON_PROFILE,
  type BordersMm,
  type CardProfile,
  type FaceSide,
  type FaceStatus,
} from "./types.js";
import { ransacLine, subpixelPeak, type Point } from "./geometry.js";

export interface PipelineResult {
  face: FaceReport;
  timingMs: number;
}

export function measureFromKnownBorders(
  face: FaceSide,
  borders: BordersMm,
  opts?: Partial<MeasureBordersInput>,
  profile: CardProfile = DEFAULT_POKEMON_PROFILE,
): PipelineResult {
  const started = performance.now();
  const report = faceFromBorders({ face, borders, ...opts }, profile);
  return { face: report, timingMs: performance.now() - started };
}

/**
 * Estimate status from border consistency.
 * Full-art / missing inner frame → UNSUPPORTED.
 */
export function statusFromBorders(borders: BordersMm): FaceStatus {
  const values = [borders.L, borders.R, borders.T, borders.B];
  if (values.some((v) => !Number.isFinite(v) || v < 0.15)) {
    return "UNSUPPORTED";
  }
  if (values.some((v) => v > 8)) {
    return "LOW_CONFIDENCE";
  }
  return "OK";
}

export function refineEdgePeaks(
  profiles: number[][],
  seed = 1,
): { peaks: number[]; linePoints: Point[] } {
  const peaks: number[] = [];
  const linePoints: Point[] = [];
  profiles.forEach((profile, station) => {
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < profile.length; i++) {
      const v = profile[i]!;
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    }
    const peak = subpixelPeak(profile, maxIdx);
    peaks.push(peak);
    linePoints.push({ x: station, y: peak });
  });
  ransacLine(linePoints, 60, 1.2, seed);
  return { peaks, linePoints };
}

export { DEFAULT_POKEMON_PROFILE };
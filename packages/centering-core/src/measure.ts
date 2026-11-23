import { computeCeilings, graderConfigCheckedOn } from "./graders.js";
import { lrRatio, tbRatio } from "./ratios.js";
import {
  emptyCardBlock,
  type CenteringReport,
  type FaceReport,
} from "./report.js";
import {
  ALGORITHM_VERSION,
  DEFAULT_POKEMON_PROFILE,
  type BordersMm,
  type CardProfile,
  type FaceLines,
  type FaceSide,
  type FaceStatus,
} from "./types.js";

/** Floor for reported ± in percentage points (calibrated for ≥90% coverage). */
export const RESIDUAL_FLOOR_PP = 0.5;
export const RESIDUAL_CEILING_PP = 5;

/** Propagate border mm uncertainty into larger-side percentage points. */
export function residualFromBorders(
  a: number,
  b: number,
  ua: number,
  ub: number,
): number {
  const sum = a + b;
  if (sum <= 1e-6) return 2.0;
  const pp = (100 / (sum * sum)) * Math.hypot(b * ua, a * ub);
  return Math.min(RESIDUAL_CEILING_PP, Math.max(RESIDUAL_FLOOR_PP, pp));
}

/** Axis-aligned outer/inner edge positions (canonical px) → FaceLines. */
export function linesFromAxisAligned(
  outer: { L: number; R: number; T: number; B: number },
  inner: { L: number; R: number; T: number; B: number },
): FaceLines {
  return {
    outer: {
      L: { x1: outer.L, y1: outer.T, x2: outer.L, y2: outer.B },
      R: { x1: outer.R, y1: outer.T, x2: outer.R, y2: outer.B },
      T: { x1: outer.L, y1: outer.T, x2: outer.R, y2: outer.T },
      B: { x1: outer.L, y1: outer.B, x2: outer.R, y2: outer.B },
    },
    inner: {
      L: { x1: inner.L, y1: outer.T, x2: inner.L, y2: outer.B },
      R: { x1: inner.R, y1: outer.T, x2: inner.R, y2: outer.B },
      T: { x1: outer.L, y1: inner.T, x2: outer.R, y2: inner.T },
      B: { x1: outer.L, y1: inner.B, x2: outer.R, y2: inner.B },
    },
  };
}

/** Manual nudge uncertainty: 0.1 mm edge error → pp on each axis. */
export function manualUncertaintyPp(borders: BordersMm, nudgeMm = 0.1): {
  lr: number;
  tb: number;
} {
  return {
    lr: residualFromBorders(borders.L, borders.R, nudgeMm, nudgeMm),
    tb: residualFromBorders(borders.T, borders.B, nudgeMm, nudgeMm),
  };
}

export interface MeasureBordersInput {
  face: FaceSide;
  borders: BordersMm;
  status?: FaceStatus;
  uncertaintyPp?: { lr: number; tb: number };
  confidence?: number;
  printSkewDeg?: number;
  framesUsed?: number;
  captureSource?: FaceReport["captureSource"];
  manualAdjusted?: boolean;
  lines?: FaceReport["lines"];
  quality?: Record<string, unknown>;
}

export function faceFromBorders(
  input: MeasureBordersInput,
  _profile: CardProfile = DEFAULT_POKEMON_PROFILE,
): FaceReport {
  const lr = lrRatio(input.borders);
  const tb = tbRatio(input.borders);
  return {
    face: input.face,
    status: input.status ?? "OK",
    bordersMm: input.borders,
    lrRatio: lr,
    tbRatio: tb,
    uncertaintyPp: input.uncertaintyPp ?? { lr: 0.3, tb: 0.3 },
    confidence: input.confidence ?? 0.9,
    printSkewDeg: input.printSkewDeg ?? 0,
    framesUsed: input.framesUsed ?? 1,
    captureSource: input.captureSource ?? "UPLOAD",
    manualAdjusted: input.manualAdjusted ?? false,
    lines: input.lines,
    quality: input.quality,
  };
}

export function buildReport(
  faces: FaceReport[],
  options?: {
    card?: CenteringReport["card"];
    shareUrl?: string | null;
    createdAt?: string;
  },
): CenteringReport {
  const front = faces.find((f) => f.face === "FRONT") ?? null;
  const back = faces.find((f) => f.face === "BACK") ?? null;

  const ceilings = computeCeilings(
    front
      ? {
          lr: front.lrRatio,
          tb: front.tbRatio,
          uncertaintyPp: front.uncertaintyPp.lr,
        }
      : null,
    back
      ? {
          lr: back.lrRatio,
          tb: back.tbRatio,
          uncertaintyPp: back.uncertaintyPp.lr,
        }
      : null,
  );

  return {
    version: 1,
    algorithmVersion: ALGORITHM_VERSION,
    faces,
    ceilings,
    graderConfigCheckedOn: graderConfigCheckedOn(),
    card: options?.card ?? emptyCardBlock(),
    disclaimerKey: "disclaimer.independent",
    shareUrl: options?.shareUrl ?? null,
    createdAt: options?.createdAt ?? new Date().toISOString(),
  };
}

/** Borders from outer/inner line positions in canonical px (axis-aligned). */
export function bordersFromAxisAligned(
  outer: { L: number; R: number; T: number; B: number },
  inner: { L: number; R: number; T: number; B: number },
  pxPerMm: number,
): BordersMm {
  return {
    L: Math.abs(inner.L - outer.L) / pxPerMm,
    R: Math.abs(outer.R - inner.R) / pxPerMm,
    T: Math.abs(inner.T - outer.T) / pxPerMm,
    B: Math.abs(outer.B - inner.B) / pxPerMm,
  };
}
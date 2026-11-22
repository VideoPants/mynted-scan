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
  type FaceSide,
  type FaceStatus,
} from "./types.js";

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
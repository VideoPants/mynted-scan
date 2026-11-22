export type FaceSide = "FRONT" | "BACK";

export type FaceStatus = "OK" | "LOW_CONFIDENCE" | "UNSUPPORTED" | "MANUAL";

export type GraderStatus = "official" | "third-party" | "unverified";

export type Company = "PSA" | "CGC" | "BGS" | "TAG";

export type IdentitySource = "USER" | "AUTO";

export interface BordersMm {
  L: number;
  R: number;
  T: number;
  B: number;
}

export interface AxisRatio {
  /** Larger side percentage, e.g. 53.2 */
  larger: number;
  /** Smaller side percentage */
  smaller: number;
  /** Which side is wider for LR or TB */
  wider: "L" | "R" | "T" | "B";
  /** Raw larger/(L+R)*100 before display rounding */
  raw: number;
}

export interface Line2D {
  /** Line in ax + by + c = 0 form, or two points */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FaceLines {
  outer: { L: Line2D; R: Line2D; T: Line2D; B: Line2D };
  inner: { L: Line2D; R: Line2D; T: Line2D; B: Line2D };
}

export interface CardProfile {
  id: string;
  widthMm: number;
  heightMm: number;
  pxPerMm: number;
  cornerSkipFraction: number;
  stationsPerEdge: number;
  printSkewWarnDeg: number;
}

export const DEFAULT_POKEMON_PROFILE: CardProfile = {
  id: "pokemon-en",
  widthMm: 63,
  heightMm: 88,
  pxPerMm: 20,
  cornerSkipFraction: 0.12,
  stationsPerEdge: 60,
  printSkewWarnDeg: 0.5,
};

export const ALGORITHM_VERSION = "1.0.0";
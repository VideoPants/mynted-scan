import { z } from "zod";
import { ALGORITHM_VERSION } from "./types.js";

export const FaceReportSchema = z.object({
  face: z.enum(["FRONT", "BACK"]),
  status: z.enum(["OK", "LOW_CONFIDENCE", "UNSUPPORTED", "MANUAL"]),
  bordersMm: z.object({
    L: z.number(),
    R: z.number(),
    T: z.number(),
    B: z.number(),
  }),
  lrRatio: z.object({
    larger: z.number(),
    smaller: z.number(),
    wider: z.enum(["L", "R", "T", "B"]),
    raw: z.number(),
  }),
  tbRatio: z.object({
    larger: z.number(),
    smaller: z.number(),
    wider: z.enum(["L", "R", "T", "B"]),
    raw: z.number(),
  }),
  uncertaintyPp: z.object({
    lr: z.number(),
    tb: z.number(),
  }),
  confidence: z.number().min(0).max(1),
  printSkewDeg: z.number(),
  framesUsed: z.number().int().positive(),
  captureSource: z.enum(["CAMERA", "UPLOAD", "SCANNER"]),
  manualAdjusted: z.boolean(),
  lines: z
    .object({
      outer: z.record(z.string(), z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() })),
      inner: z.record(z.string(), z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() })),
    })
    .optional(),
  quality: z.record(z.string(), z.unknown()).optional(),
});

export const CardBlockSchema = z.object({
  cardId: z.string().nullable(),
  setId: z.string().nullable(),
  setName: z.string().nullable(),
  number: z.string().nullable(),
  name: z.string().nullable(),
  imageUrl: z.string().nullable(),
  identitySource: z.enum(["USER", "AUTO"]),
  identityConfidence: z.number().nullable(),
});

export const CeilingSchema = z.object({
  company: z.enum(["PSA", "CGC", "BGS", "TAG"]),
  grade: z.string(),
  label: z.string(),
  frontCeiling: z.string().nullable(),
  backCeiling: z.string().nullable(),
  overallCeiling: z.string().nullable(),
  borderline: z.boolean(),
  borderlineGrades: z.array(z.string()).optional(),
  sourceUrl: z.string(),
  checkedOn: z.string(),
  status: z.enum(["official", "third-party", "unverified"]),
});

export const CenteringReportSchema = z.object({
  version: z.literal(1),
  algorithmVersion: z.string(),
  faces: z.array(FaceReportSchema),
  ceilings: z.array(CeilingSchema),
  graderConfigCheckedOn: z.string(),
  card: CardBlockSchema,
  disclaimerKey: z.string(),
  shareUrl: z.string().nullable(),
  createdAt: z.string(),
});

export type FaceReport = z.infer<typeof FaceReportSchema>;
export type CenteringReport = z.infer<typeof CenteringReportSchema>;
export type CardBlock = z.infer<typeof CardBlockSchema>;

export function emptyCardBlock(): CardBlock {
  return {
    cardId: null,
    setId: null,
    setName: null,
    number: null,
    name: null,
    imageUrl: null,
    identitySource: "USER",
    identityConfidence: null,
  };
}

export { ALGORITHM_VERSION };
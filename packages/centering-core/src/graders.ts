import { z } from "zod";
import gradersJson from "../config/graders.json" with { type: "json" };
import type { AxisRatio, Company, FaceSide } from "./types.js";

export const GraderRowSchema = z.object({
  company: z.enum(["PSA", "CGC", "BGS", "TAG"]),
  grade: z.string(),
  label: z.string(),
  front: z.number(),
  back: z.number().nullable(),
  sourceUrl: z.string(),
  checkedOn: z.string(),
  status: z.enum(["official", "third-party", "unverified"]),
  notes: z.string().optional(),
});

export type GraderRow = z.infer<typeof GraderRowSchema>;

export const GraderConfigSchema = z.array(GraderRowSchema);

export function loadGraders(raw: unknown = gradersJson): GraderRow[] {
  return GraderConfigSchema.parse(raw);
}

/**
 * Compare without rounding: 55.05 does not pass a threshold of 55.
 * Passes when rawLarger <= maxAllowed.
 */
export function passesThreshold(rawLarger: number, maxAllowed: number | null): boolean {
  if (maxAllowed === null) return false;
  return rawLarger <= maxAllowed;
}

export interface CeilingResult {
  company: Company;
  grade: string;
  label: string;
  frontCeiling: string | null;
  backCeiling: string | null;
  overallCeiling: string | null;
  borderline: boolean;
  borderlineGrades?: string[];
  sourceUrl: string;
  checkedOn: string;
  status: GraderRow["status"];
}

function faceRaw(lr: AxisRatio, tb: AxisRatio): number {
  return Math.max(lr.raw, tb.raw);
}

function bestGradeForFace(
  rows: GraderRow[],
  company: Company,
  face: FaceSide,
  raw: number,
): GraderRow | null {
  const faceRows = rows
    .filter((r) => r.company === company)
    .filter((r) => (face === "FRONT" ? true : r.back !== null));

  let best: GraderRow | null = null;
  for (const row of faceRows) {
    const threshold = face === "FRONT" ? row.front : row.back;
    if (!passesThreshold(raw, threshold)) continue;
    if (!best || gradeRank(row.grade) > gradeRank(best.grade)) {
      best = row;
    }
  }
  return best;
}

function gradeRank(grade: string): number {
  const n = Number.parseFloat(grade.replace(/[^\d.]/g, ""));
  if (Number.isFinite(n)) return n;
  if (grade.includes("Pristine")) return 10.1;
  if (grade.includes("Gem")) return 10;
  return 0;
}

function lowerCeiling(a: GraderRow | null, b: GraderRow | null): GraderRow | null {
  if (!a) return b;
  if (!b) return a;
  return gradeRank(a.grade) <= gradeRank(b.grade) ? a : b;
}

export function isBorderline(
  raw: number,
  uncertainty: number,
  threshold: number | null,
): boolean {
  if (threshold === null) return false;
  const lo = raw - uncertainty;
  const hi = raw + uncertainty;
  return lo < threshold && hi >= threshold;
}

export interface FaceInputs {
  lr: AxisRatio;
  tb: AxisRatio;
  uncertaintyPp: number;
}

export function computeCeilings(
  front: FaceInputs | null,
  back: FaceInputs | null,
  rows: GraderRow[] = loadGraders(),
): CeilingResult[] {
  const companies: Company[] = ["PSA", "CGC", "BGS", "TAG"];
  const results: CeilingResult[] = [];

  for (const company of companies) {
    const companyRows = rows.filter((r) => r.company === company);
    const frontRaw = front ? faceRaw(front.lr, front.tb) : null;
    const backRaw = back ? faceRaw(back.lr, back.tb) : null;

    const frontBest =
      front && frontRaw !== null
        ? bestGradeForFace(companyRows, company, "FRONT", frontRaw)
        : null;
    const backBest =
      back && backRaw !== null
        ? bestGradeForFace(companyRows, company, "BACK", backRaw)
        : null;
    const overall = lowerCeiling(frontBest, backBest);

    let borderline = false;
    const borderlineGrades: string[] = [];
    for (const row of companyRows) {
      if (front && isBorderline(frontRaw!, front.uncertaintyPp, row.front)) {
        borderline = true;
        borderlineGrades.push(`${row.label} front`);
      }
      if (back && row.back !== null && isBorderline(backRaw!, back.uncertaintyPp, row.back)) {
        borderline = true;
        borderlineGrades.push(`${row.label} back`);
      }
    }

    const sample = companyRows[0];
    results.push({
      company,
      grade: overall?.grade ?? "—",
      label: overall?.label ?? "No ceiling",
      frontCeiling: frontBest?.label ?? null,
      backCeiling: backBest?.label ?? null,
      overallCeiling: overall?.label ?? null,
      borderline,
      borderlineGrades: borderline ? borderlineGrades : undefined,
      sourceUrl: sample?.sourceUrl ?? "",
      checkedOn: sample?.checkedOn ?? "",
      status: sample?.status ?? "unverified",
    });
  }

  return results;
}

export function graderConfigCheckedOn(rows: GraderRow[] = loadGraders()): string {
  const dates = rows.map((r) => r.checkedOn).sort();
  return dates[dates.length - 1] ?? "";
}
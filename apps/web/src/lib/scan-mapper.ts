import {
  buildReport,
  faceFromBorders,
  type CenteringReport,
  type FaceReport,
} from "@mynted/centering-core";
import type { Scan, ScanFace } from "@prisma/client";

export function faceReportFromDb(face: ScanFace): FaceReport {
  return faceFromBorders({
    face: face.face,
    borders: {
      L: face.borderL,
      R: face.borderR,
      T: face.borderT,
      B: face.borderB,
    },
    status: face.status,
    uncertaintyPp: { lr: face.uncertaintyLr, tb: face.uncertaintyTb },
    confidence: face.confidence,
    printSkewDeg: face.printSkewDeg,
    framesUsed: face.framesUsed,
    captureSource: face.captureSource,
    manualAdjusted: face.manualAdjusted,
    lines: (face.linesJson as FaceReport["lines"]) ?? undefined,
    quality: (face.qualityJson as Record<string, unknown>) ?? undefined,
  });
}

export function reportFromScan(
  scan: Scan & { faces: ScanFace[] },
  shareUrl: string | null = null,
): CenteringReport {
  const faces = scan.faces.map(faceReportFromDb);
  return buildReport(faces, {
    shareUrl,
    createdAt: scan.createdAt.toISOString(),
    card: {
      cardId: scan.cardId,
      setId: scan.setId,
      setName: scan.setName,
      number: scan.number,
      name: scan.name,
      imageUrl: scan.imageUrl,
      identitySource: scan.identitySource,
      identityConfidence: scan.identityConfidence,
    },
  });
}
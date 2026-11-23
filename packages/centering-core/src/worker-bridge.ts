/**
 * IIFE entry for the classic measure worker.
 * Expects global `cv` (OpenCV.js) and exposes `self.MyntedMeasure`.
 */
import { measureImagePixels, MeasureError, type OpenCvLike } from "./image-pipeline.js";
import { faceFromBorders } from "./measure.js";
import { statusFromBorders } from "./pipeline.js";
import type { BordersMm, FaceSide } from "./types.js";
import type { FaceReport } from "./report.js";

export type WorkerMeasureApi = {
  measureImagePixels: typeof measureImagePixels;
  MeasureError: typeof MeasureError;
  faceFromBorders: typeof faceFromBorders;
  statusFromBorders: typeof statusFromBorders;
  measureFromBordersPayload: (
    face: FaceSide,
    borders: BordersMm,
    opts?: Partial<FaceReport>,
  ) => FaceReport;
};

const api: WorkerMeasureApi = {
  measureImagePixels,
  MeasureError,
  faceFromBorders,
  statusFromBorders,
  measureFromBordersPayload(face, borders, opts) {
    return faceFromBorders({
      face,
      borders,
      status: opts?.status ?? statusFromBorders(borders),
      uncertaintyPp: opts?.uncertaintyPp,
      confidence: opts?.confidence,
      framesUsed: opts?.framesUsed,
      captureSource: opts?.captureSource,
      manualAdjusted: opts?.manualAdjusted,
      lines: opts?.lines,
      quality: opts?.quality,
    });
  },
};

const workerSelf = globalThis as typeof globalThis & {
  MyntedMeasure?: WorkerMeasureApi;
  cv?: OpenCvLike;
};

workerSelf.MyntedMeasure = api;

export { api };

import type { CenteringReport, FaceReport } from "@mynted/centering-core";
import { buildReport, emptyCardBlock } from "@mynted/centering-core";

const KEY = "myntedscan.draft";

export interface DraftScan {
  faces: FaceReport[];
  imageUrls: { FRONT?: string; BACK?: string };
  report: CenteringReport;
}

export function saveDraft(faces: FaceReport[], imageUrls: DraftScan["imageUrls"]): DraftScan {
  const report = buildReport(faces, { card: emptyCardBlock() });
  const draft: DraftScan = { faces, imageUrls, report };
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  }
  return draft;
}

export function loadDraft(): DraftScan | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraftScan;
  } catch {
    return null;
  }
}

export function clearDraft() {
  sessionStorage.removeItem(KEY);
}
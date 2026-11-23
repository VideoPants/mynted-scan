import type { CenteringReport, FaceReport } from "@mynted/centering-core";
import { buildReport, emptyCardBlock } from "@mynted/centering-core";

const KEY = "myntedscan.draft";

export interface DraftScan {
  faces: FaceReport[];
  imageUrls: { FRONT?: string; BACK?: string };
  report: CenteringReport;
}

function revokeIfBlob(url: string | undefined) {
  if (url && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

function stripTransientUrls(faces: FaceReport[]): FaceReport[] {
  return faces.map((f) => {
    const q = { ...(f.quality ?? {}) } as Record<string, unknown>;
    // Keep durable data URL; drop ephemeral blob URL from persisted draft.
    delete q.rectifiedUrl;
    return { ...f, quality: q };
  });
}

export function saveDraft(faces: FaceReport[], imageUrls: DraftScan["imageUrls"]): DraftScan {
  const prev = loadDraft();
  if (prev) {
    for (const f of prev.faces) {
      const q = f.quality as Record<string, unknown> | undefined;
      revokeIfBlob(typeof q?.rectifiedUrl === "string" ? q.rectifiedUrl : undefined);
    }
    revokeIfBlob(prev.imageUrls.FRONT);
    revokeIfBlob(prev.imageUrls.BACK);
  }

  const durableFaces = stripTransientUrls(faces);
  const report = buildReport(durableFaces, {
    card: prev?.report.card ?? emptyCardBlock(),
  });
  const draft: DraftScan = { faces: durableFaces, imageUrls, report };
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
  const prev = loadDraft();
  if (prev) {
    for (const f of prev.faces) {
      const q = f.quality as Record<string, unknown> | undefined;
      revokeIfBlob(typeof q?.rectifiedUrl === "string" ? q.rectifiedUrl : undefined);
    }
    revokeIfBlob(prev.imageUrls.FRONT);
    revokeIfBlob(prev.imageUrls.BACK);
  }
  sessionStorage.removeItem(KEY);
}

export function faceRectifiedSrc(face: FaceReport): string | undefined {
  const q = face.quality as Record<string, unknown> | undefined;
  if (!q) return undefined;
  if (typeof q.rectifiedUrl === "string" && q.rectifiedUrl) return q.rectifiedUrl;
  if (typeof q.rectifiedDataUrl === "string" && q.rectifiedDataUrl) return q.rectifiedDataUrl;
  return undefined;
}

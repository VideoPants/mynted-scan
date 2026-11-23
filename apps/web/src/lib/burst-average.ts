import type { BordersMm, FaceReport } from "@mynted/centering-core";
import { faceFromBorders } from "@mynted/centering-core";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function leftPct(b: BordersMm): number {
  const sum = b.L + b.R;
  return sum <= 0 ? 50 : (b.L / sum) * 100;
}

function topPct(b: BordersMm): number {
  const sum = b.T + b.B;
  return sum <= 0 ? 50 : (b.T / sum) * 100;
}

/** Drop outlier frames, take median borders, fold frame spread into ±. */
export function averageBurstFaces(frames: FaceReport[]): FaceReport {
  const ok = frames.filter((f) => f.status === "OK" || f.status === "LOW_CONFIDENCE");
  const pool = ok.length >= 3 ? ok : frames;
  if (pool.length === 0) {
    throw new Error("measure_failed");
  }

  const medL = median(pool.map((f) => f.bordersMm.L));
  const medR = median(pool.map((f) => f.bordersMm.R));
  const medT = median(pool.map((f) => f.bordersMm.T));
  const medB = median(pool.map((f) => f.bordersMm.B));

  const kept = pool.filter((f) => {
    const d =
      Math.abs(f.bordersMm.L - medL) +
      Math.abs(f.bordersMm.R - medR) +
      Math.abs(f.bordersMm.T - medT) +
      Math.abs(f.bordersMm.B - medB);
    return d < 1.5; // mm total deviation across sides
  });
  const use = kept.length >= 2 ? kept : pool;

  const borders: BordersMm = {
    L: median(use.map((f) => f.bordersMm.L)),
    R: median(use.map((f) => f.bordersMm.R)),
    T: median(use.map((f) => f.bordersMm.T)),
    B: median(use.map((f) => f.bordersMm.B)),
  };

  const lrPcts = use.map((f) => leftPct(f.bordersMm)).sort((a, b) => a - b);
  const tbPcts = use.map((f) => topPct(f.bordersMm)).sort((a, b) => a - b);
  const spread = (sorted: number[]) => {
    if (sorted.length < 2) return 0;
    const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)]!;
    const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)]!;
    return Math.max(0, (q3 - q1) / 1.349 / Math.sqrt(sorted.length));
  };

  const base = use.find((f) => f.status === "OK") ?? use[0]!;
  const lrUnc = Math.max(base.uncertaintyPp.lr, spread(lrPcts));
  const tbUnc = Math.max(base.uncertaintyPp.tb, spread(tbPcts));
  const worst = Math.max(lrUnc, tbUnc);
  const status =
    base.status === "UNSUPPORTED"
      ? "UNSUPPORTED"
      : worst > 1.5
        ? "LOW_CONFIDENCE"
        : base.status === "LOW_CONFIDENCE"
          ? "LOW_CONFIDENCE"
          : "OK";

  return faceFromBorders({
    face: base.face,
    borders,
    status,
    confidence: base.confidence,
    framesUsed: use.length,
    captureSource: base.captureSource,
    uncertaintyPp: { lr: lrUnc, tb: tbUnc },
    lines: base.lines,
    quality: {
      ...(base.quality ?? {}),
      burstFrames: frames.length,
      framesKept: use.length,
    },
  });
}

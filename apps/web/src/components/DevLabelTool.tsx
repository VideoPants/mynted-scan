"use client";

import { useState } from "react";
import {
  faceFromBorders,
  formatRatioPair,
  type BordersMm,
} from "@mynted/centering-core";

export function DevLabelTool() {
  const [borders, setBorders] = useState<BordersMm>({
    L: 3,
    R: 3,
    T: 3,
    B: 3,
  });
  const face = faceFromBorders({
    face: "FRONT",
    borders,
    status: "MANUAL",
    manualAdjusted: true,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dev label tool</h1>
      <p className="text-sm text-[var(--color-subtext)]">
        Adjust borders (mm) for agent-labelled ground truth. Disabled in production.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["L", "R", "T", "B"] as const).map((side) => (
          <label key={side} className="text-sm">
            {side}
            <input
              type="number"
              step="0.1"
              value={borders[side]}
              className="mt-1 w-full rounded-[var(--radius)] border border-black/15 px-2 py-1 mono-num"
              onChange={(e) =>
                setBorders((b) => ({ ...b, [side]: Number(e.target.value) }))
              }
            />
          </label>
        ))}
      </div>
      <p className="mono-num">
        LR {formatRatioPair(face.lrRatio)} · TB {formatRatioPair(face.tbRatio)}
      </p>
      <pre className="overflow-auto rounded-[var(--radius)] bg-[var(--color-secondary)] p-3 text-xs">
        {JSON.stringify({ source: "agent-labelled", bordersMm: borders }, null, 2)}
      </pre>
    </div>
  );
}
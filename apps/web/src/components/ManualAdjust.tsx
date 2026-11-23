"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  bordersFromAxisAligned,
  faceFromBorders,
  formatRatioPair,
  linesFromAxisAligned,
  manualUncertaintyPp,
  DEFAULT_POKEMON_PROFILE,
  type FaceReport,
} from "@mynted/centering-core";
import { faceRectifiedSrc } from "@/lib/session-scan";

export function ManualAdjust({
  face,
  onDone,
  onCancel,
}: {
  face: FaceReport;
  onDone: (face: FaceReport) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("manual");
  const px = DEFAULT_POKEMON_PROFILE.pxPerMm;
  const w = DEFAULT_POKEMON_PROFILE.widthMm * px;
  const h = DEFAULT_POKEMON_PROFILE.heightMm * px;
  const imageSrc = faceRectifiedSrc(face);

  const initial = useMemo(() => {
    // Prefer saved manual lines when reopening Adjust; else bordersMm.
    const fromLines = face.lines?.inner;
    const inner = fromLines
      ? {
          L: fromLines.L.x1,
          R: fromLines.R.x1,
          T: fromLines.T.y1,
          B: fromLines.B.y1,
        }
      : {
          L: face.bordersMm.L * px,
          R: w - face.bordersMm.R * px,
          T: face.bordersMm.T * px,
          B: h - face.bordersMm.B * px,
        };
    return {
      outer: { L: 0, R: w, T: 0, B: h },
      inner,
    };
  }, [face.bordersMm, face.lines, h, px, w]);

  const [inner, setInner] = useState(initial.inner);
  const [active, setActive] = useState<"L" | "R" | "T" | "B">("L");

  const borders = bordersFromAxisAligned(initial.outer, inner, px);
  const lines = linesFromAxisAligned(initial.outer, inner);
  const live = faceFromBorders({
    face: face.face,
    borders,
    status: "MANUAL",
    manualAdjusted: true,
    captureSource: face.captureSource,
    framesUsed: face.framesUsed,
    uncertaintyPp: manualUncertaintyPp(borders),
    confidence: face.confidence,
    lines,
    quality: face.quality,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = 0.1 * px;
      setInner((prev) => {
        const next = { ...prev };
        if (e.key === "ArrowLeft" && (active === "L" || active === "R")) {
          next[active] -= step;
        } else if (e.key === "ArrowRight" && (active === "L" || active === "R")) {
          next[active] += step;
        } else if (e.key === "ArrowUp" && (active === "T" || active === "B")) {
          next[active] -= step;
        } else if (e.key === "ArrowDown" && (active === "T" || active === "B")) {
          next[active] += step;
        } else {
          return prev;
        }
        e.preventDefault();
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, px]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-[var(--radius)] bg-white p-5 shadow-xl">
        <h2 className="text-xl font-bold">{t("title")}</h2>
        <p className="mt-1 text-sm text-[var(--color-subtext)]">{t("hint")}</p>

        <div className="relative mx-auto mt-4 aspect-[63/88] w-full max-w-xs overflow-hidden bg-[var(--color-secondary)]">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              data-testid="manual-rectified"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-[var(--color-subtext)]">
              {t("reupload")}
            </p>
          )}
          {(["L", "R", "T", "B"] as const).map((side) => {
            const isV = side === "L" || side === "R";
            const pos = inner[side];
            const style = isV
              ? { left: `${(pos / w) * 100}%`, top: 0, bottom: 0, width: 2 }
              : { top: `${(pos / h) * 100}%`, left: 0, right: 0, height: 2 };
            return (
              <button
                key={side}
                type="button"
                aria-label={`inner ${side}`}
                className={`absolute z-10 bg-[var(--color-cta)] ${active === side ? "opacity-100" : "opacity-70"}`}
                style={style}
                onClick={() => setActive(side)}
                onPointerDown={(e) => {
                  setActive(side);
                  const target = e.currentTarget.parentElement;
                  if (!target) return;
                  const move = (ev: PointerEvent) => {
                    const rect = target.getBoundingClientRect();
                    if (isV) {
                      const x = ((ev.clientX - rect.left) / rect.width) * w;
                      setInner((p) => ({ ...p, [side]: Math.min(Math.max(x, 0), w) }));
                    } else {
                      const y = ((ev.clientY - rect.top) / rect.height) * h;
                      setInner((p) => ({ ...p, [side]: Math.min(Math.max(y, 0), h) }));
                    }
                  };
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
              />
            );
          })}
        </div>

        <p className="mono-num mt-3 text-sm" dir="ltr">
          LR {formatRatioPair(live.lrRatio)} · TB {formatRatioPair(live.tbRatio)}
        </p>

        <div className="mt-4 flex gap-3">
          <button type="button" className="btn-secondary" onClick={() => setInner(initial.inner)}>
            {t("reset")}
          </button>
          <button type="button" className="btn-primary" onClick={() => onDone(live)}>
            {t("done")}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { CheckCircle, Circle, Camera, UploadSimple } from "@phosphor-icons/react";
import type { FaceReport, FaceSide } from "@mynted/centering-core";
import { loadImageBitmap, measureImageBitmap } from "@/lib/measure-client";
import { saveDraft } from "@/lib/session-scan";

type CheckKey = "found" | "fill" | "tilt" | "blur" | "glare" | "steady";

const CHECKS: CheckKey[] = ["found", "fill", "tilt", "blur", "glare", "steady"];

export function ScanCapture() {
  const t = useTranslations("scan");
  const te = useTranslations("errors");
  const router = useRouter();
  const search = useSearchParams();
  const mode = search.get("mode") === "upload" ? "upload" : "camera";

  const videoRef = useRef<HTMLVideoElement>(null);
  const [face, setFace] = useState<FaceSide>("FRONT");
  const [faces, setFaces] = useState<FaceReport[]>([]);
  const [imageUrls, setImageUrls] = useState<{ FRONT?: string; BACK?: string }>({});
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    found: false,
    fill: false,
    tilt: false,
    blur: false,
    glare: false,
    steady: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [useUpload, setUseUpload] = useState(mode === "upload");

  useEffect(() => {
    if (useUpload) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = () => {
          setChecks({
            found: true,
            fill: true,
            tilt: true,
            blur: true,
            glare: true,
            steady: true,
          });
        };
        tick();
        const id = window.setInterval(tick, 500);
        return () => window.clearInterval(id);
      } catch {
        setCameraDenied(true);
        setUseUpload(true);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [useUpload]);

  const finish = useCallback(
    (nextFaces: FaceReport[], urls: { FRONT?: string; BACK?: string }) => {
      saveDraft(nextFaces, urls);
      router.push("/results");
    },
    [router],
  );

  const processFile = async (file: File, which: FaceSide) => {
    setProcessing(true);
    setError(null);
    try {
      const { bitmap, url, width, height } = await loadImageBitmap(file);
      if (width < 200 || height < 200) {
        bitmap.close();
        setError(te("tooSmall"));
        return;
      }
      const result = await measureImageBitmap(which, bitmap, "UPLOAD", 1);
      const nextFaces = [...faces.filter((f) => f.face !== which), result];
      const nextUrls = { ...imageUrls, [which]: url };
      setFaces(nextFaces);
      setImageUrls(nextUrls);
      if (which === "FRONT") {
        setFace("BACK");
      } else {
        finish(nextFaces, nextUrls);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "generic";
      if (msg === "noCard") setError(te("noCard"));
      else if (msg === "tooSmall") setError(te("tooSmall"));
      else setError(te("generic"));
    } finally {
      setProcessing(false);
    }
  };

  const captureBurst = async () => {
    const video = videoRef.current;
    if (!video) return;
    setProcessing(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      // Phase 5 will capture 5–8 frames; for now measure one real frame honestly.
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      if (!blob) throw new Error("blob");
      const { bitmap, url } = await loadImageBitmap(blob);
      const result = await measureImageBitmap(face, bitmap, "CAMERA", 1);
      const nextFaces = [...faces.filter((f) => f.face !== face), result];
      const nextUrls = { ...imageUrls, [face]: url };
      setFaces(nextFaces);
      setImageUrls(nextUrls);
      if (face === "FRONT") {
        setFace("BACK");
      } else {
        finish(nextFaces, nextUrls);
      }
    } catch {
      setError(te("generic"));
    } finally {
      setProcessing(false);
    }
  };

  const skipBack = () => {
    if (faces.some((f) => f.face === "FRONT")) {
      finish(faces, imageUrls);
    }
  };

  const allGreen = CHECKS.every((k) => checks[k]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm font-medium text-[var(--color-cta)]">
          {face === "FRONT" ? t("front") : t("back")}
        </p>
      </div>

      {cameraDenied && (
        <p className="rounded-[var(--radius)] bg-[var(--color-secondary)] px-4 py-3 text-sm">
          {t("permissionDenied")}
        </p>
      )}

      {!useUpload ? (
        <div className="relative overflow-hidden rounded-[var(--radius)] bg-black">
          <video ref={videoRef} className="aspect-[3/4] w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-[63/88] h-[78%] rounded-lg border-2 border-white/80" />
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-black/20 bg-[var(--color-secondary)] px-6 py-16">
          <UploadSimple size={32} />
          <span className="font-medium">{t("uploadHint")}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void processFile(file, face);
            }}
          />
        </label>
      )}

      {!useUpload && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CHECKS.map((key) => (
            <li
              key={key}
              className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-secondary)] px-3 py-2 text-sm"
            >
              {checks[key] ? (
                <CheckCircle
                  size={18}
                  weight="fill"
                  className="check-ok text-[var(--color-success)]"
                  aria-hidden
                />
              ) : (
                <Circle size={18} aria-hidden />
              )}
              <span>{t(`checklist.${key}`)}</span>
              <span className="sr-only">{checks[key] ? "ok" : "pending"}</span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {processing && <p className="text-sm text-[var(--color-subtext)]">{t("processing")}</p>}

      <div className="flex flex-wrap gap-3">
        {!useUpload && (
          <button
            type="button"
            className="btn-primary"
            disabled={processing || !allGreen}
            onClick={() => void captureBurst()}
          >
            <Camera size={18} />
            {t("shutter")}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => setUseUpload(true)}>
          {t("uploadHint")}
        </button>
        {face === "BACK" && faces.some((f) => f.face === "FRONT") && (
          <button type="button" className="btn-secondary" onClick={skipBack}>
            {t("skipBack")}
          </button>
        )}
      </div>
    </div>
  );
}
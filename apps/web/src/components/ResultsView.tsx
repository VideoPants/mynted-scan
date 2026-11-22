"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  buildReport,
  formatRatioPair,
  type CenteringReport,
  type FaceReport,
} from "@mynted/centering-core";
import { loadDraft, saveDraft } from "@/lib/session-scan";
import { ManualAdjust } from "@/components/ManualAdjust";
import { CardPicker } from "@/components/CardPicker";

export function ResultsView({
  initialReport,
  readOnly = false,
}: {
  initialReport?: CenteringReport;
  readOnly?: boolean;
}) {
  const t = useTranslations("results");
  const ts = useTranslations("status");
  const [report, setReport] = useState<CenteringReport | null>(initialReport ?? null);
  const [faces, setFaces] = useState<FaceReport[]>(initialReport?.faces ?? []);
  const [manualFace, setManualFace] = useState<FaceReport | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialReport) return;
    const draft = loadDraft();
    if (draft) {
      setFaces(draft.faces);
      setReport(draft.report);
      const unsupported = draft.faces.find(
        (f) => f.status === "UNSUPPORTED" || f.status === "LOW_CONFIDENCE",
      );
      if (unsupported) setManualFace(unsupported);
    }
  }, [initialReport]);

  const frontOnly = useMemo(
    () => faces.some((f) => f.face === "FRONT") && !faces.some((f) => f.face === "BACK"),
    [faces],
  );

  if (!report) {
    return (
      <div className="space-y-4">
        <p>No result yet.</p>
        <Link href="/scan" className="btn-primary">
          Scan
        </Link>
      </div>
    );
  }

  const onManualDone = (updated: FaceReport) => {
    const next = [...faces.filter((f) => f.face !== updated.face), updated];
    const nextReport = buildReport(next, { card: report.card });
    setFaces(next);
    setReport(nextReport);
    saveDraft(next, loadDraft()?.imageUrls ?? {});
    setManualFace(null);
  };

  const save = async () => {
    const res = await fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report }),
    });
    if (res.status === 401) {
      setSaveMsg(t("save"));
      window.location.href = "/en/sign-in?next=/results";
      return;
    }
    if (!res.ok) {
      setSaveMsg("Save failed");
      return;
    }
    const data = (await res.json()) as { id: string };
    setSaveMsg(data.id);
  };

  const share = async () => {
    const res = await fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report, share: true }),
    });
    if (res.status === 401) {
      window.location.href = "/en/sign-in?next=/results";
      return;
    }
    const data = (await res.json()) as { shareUrl?: string };
    if (data.shareUrl) {
      await navigator.clipboard.writeText(data.shareUrl);
      setSaveMsg(data.shareUrl);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {frontOnly && (
          <p className="text-sm text-[var(--color-subtext)]">{t("frontOnly")}</p>
        )}
        {report.card.name && (
          <p className="text-sm">
            {report.card.name} · {report.card.setName} · #{report.card.number}
          </p>
        )}
      </div>

      {faces.map((face) => (
        <section key={face.face} className="space-y-3 border-t border-black/10 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{face.face}</h2>
            <span className="text-sm">{ts(face.status)}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-[var(--color-subtext)]">{t("lr")}</p>
              <p className="mono-num text-2xl font-semibold">
                {formatRatioPair(face.lrRatio)} ± {face.uncertaintyPp.lr.toFixed(1)}
              </p>
              <p className="text-xs text-[var(--color-subtext)]">
                {t("wider", { side: face.lrRatio.wider })}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-subtext)]">{t("tb")}</p>
              <p className="mono-num text-2xl font-semibold">
                {formatRatioPair(face.tbRatio)} ± {face.uncertaintyPp.tb.toFixed(1)}
              </p>
            </div>
          </div>
          <p className="mono-num text-sm">
            {t("borders")}: L {face.bordersMm.L.toFixed(2)} · R {face.bordersMm.R.toFixed(2)} · T{" "}
            {face.bordersMm.T.toFixed(2)} · B {face.bordersMm.B.toFixed(2)}
          </p>
          {!readOnly && (
            <button type="button" className="btn-secondary" onClick={() => setManualFace(face)}>
              {t("manualAdjust")}
            </button>
          )}
        </section>
      ))}

      <section className="space-y-3 border-t border-black/10 pt-6">
        <h2 className="text-lg font-semibold">{t("ceilings")}</h2>
        <p className="text-sm text-[var(--color-subtext)]">{t("ceilingsNote")}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10">
                <th className="py-2">Company</th>
                <th>Front</th>
                <th>Back</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {report.ceilings.map((c) => (
                <tr key={c.company} className="border-b border-black/5">
                  <td className="py-2 font-medium">{c.company}</td>
                  <td>{c.frontCeiling ?? "—"}</td>
                  <td>{c.backCeiling ?? "—"}</td>
                  <td>
                    {c.overallCeiling ?? "—"}
                    {c.borderline ? ` (${t("borderline")})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--color-subtext)]">
          {t("standardsChecked", { date: report.graderConfigCheckedOn })}
        </p>
      </section>

      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={() => setShowPicker(true)}>
            {t("pickCard")}
          </button>
          <button type="button" className="btn-primary" onClick={() => void save()}>
            {t("save")}
          </button>
          <button type="button" className="btn-secondary" onClick={() => void share()}>
            {t("share")}
          </button>
        </div>
      )}

      {saveMsg && <p className="break-all text-sm text-[var(--color-subtext)]">{saveMsg}</p>}

      <p className="text-xs leading-relaxed text-[var(--color-subtext)]">{t("disclaimer")}</p>

      {manualFace && (
        <ManualAdjust
          face={manualFace}
          onCancel={() => setManualFace(null)}
          onDone={onManualDone}
        />
      )}
      {showPicker && (
        <CardPicker
          onClose={() => setShowPicker(false)}
          onSelect={(card) => {
            const next = {
              ...report,
              card: {
                ...card,
                identitySource: "USER" as const,
                identityConfidence: null,
              },
            };
            setReport(next);
            saveDraft(faces, loadDraft()?.imageUrls ?? {});
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
}
"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function HistoryActions({ id }: { id: string }) {
  const t = useTranslations("history");
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        await fetch(`/api/scans/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      {t("delete")}
    </button>
  );
}
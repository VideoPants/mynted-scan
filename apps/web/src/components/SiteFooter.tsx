import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-auto border-t border-black/5 bg-[var(--color-secondary)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-[var(--color-subtext)]">
        <p>{t("privacy")}</p>
        <p>{t("attribution")}</p>
        <p>{t("independent")}</p>
      </div>
    </footer>
  );
}
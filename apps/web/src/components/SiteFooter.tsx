import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-auto border-t border-[var(--color-border)] bg-white pb-20 md:pb-0">
      <div className="page-shell flex flex-col gap-3 py-8 text-sm text-[var(--color-subtext)]">
        <p className="font-semibold text-[var(--color-text)]">MyntedScan by MYNTED</p>
        <p>{t("privacy")}</p>
        <p>{t("attribution")}</p>
        <p>{t("independent")}</p>
        <a href="https://mynted.me/" className="font-medium text-[var(--color-cta)] hover:underline">
          mynted.me
        </a>
      </div>
    </footer>
  );
}
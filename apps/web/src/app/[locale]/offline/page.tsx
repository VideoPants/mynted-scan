import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("offline");

  return (
    <section className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-sm text-[var(--color-subtext)]">{t("body")}</p>
      <Link href="/scan" className="btn-primary inline-flex">
        {t("cta")}
      </Link>
    </section>
  );
}

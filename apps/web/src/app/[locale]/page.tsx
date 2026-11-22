import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <section className="flex min-h-[70dvh] flex-col justify-center gap-8">
      <div className="max-w-xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)]">
          MYNTED {t("product")}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] md:text-5xl">
          {t("headline")}
        </h1>
        <p className="max-w-[55ch] text-base leading-relaxed text-[var(--color-subtext)]">
          {t("sub")}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/scan" className="btn-primary">
          {t("ctaScan")}
        </Link>
        <Link href="/scan?mode=upload" className="btn-secondary">
          {t("ctaUpload")}
        </Link>
      </div>
      <p className="text-sm text-[var(--color-subtext)]">{t("privacy")}</p>
    </section>
  );
}
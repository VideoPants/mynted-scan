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
    <section className="grid min-h-[70dvh] items-center gap-10 py-6 md:grid-cols-[1.15fr_0.85fr] md:gap-12 md:py-10">
      <div className="space-y-6">
        <p className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-mint)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
          MYNTED · {t("product")}
        </p>

        <h1 className="max-w-[20ch] text-[2rem] font-bold leading-[1.15] tracking-tight text-[var(--color-text)] sm:text-4xl md:text-[2.75rem]">
          {t("headlineBefore")}{" "}
          <span className="underline-market">{t("headlineAccent")}</span>{" "}
          {t("headlineAfter")}
        </h1>

        <p className="max-w-[52ch] text-base leading-relaxed text-[var(--color-subtext)]">
          {t("sub")}
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/scan" className="btn-primary">
            {t("ctaScan")}
          </Link>
          <Link href="/scan?mode=upload" className="btn-secondary">
            {t("ctaUpload")}
          </Link>
        </div>

        <p className="text-sm text-[var(--color-subtext)]">{t("privacy")}</p>
      </div>

      <div className="relative mx-auto w-full max-w-sm md:mx-0 md:justify-self-end">
        <div
          className="absolute -inset-3 rounded-[1.25rem] bg-[var(--color-mint)]/40 md:-inset-4"
          aria-hidden
        />
        <div className="relative overflow-hidden rounded-[1.1rem] border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_40px_-20px_rgba(15,17,17,0.35)]">
          <div className="relative mx-auto aspect-[63/88] w-full max-w-[220px] rounded-lg bg-[var(--color-secondary)]">
            <div className="absolute inset-[10%] rounded-md border-2 border-dashed border-[var(--color-cta)]/50" />
            <div className="absolute inset-x-[18%] top-[12%] h-px bg-[var(--color-cta)]" />
            <div className="absolute inset-x-[18%] bottom-[12%] h-px bg-[var(--color-cta)]" />
            <div className="absolute inset-y-[18%] left-[12%] w-px bg-[var(--color-cta)]" />
            <div className="absolute inset-y-[18%] right-[12%] w-px bg-[var(--color-cta)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="mono-num rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-[var(--color-text)]">
                53.2 / 46.8
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-[var(--color-secondary)] px-3 py-2">
              <p className="text-[var(--color-subtext)]">{t("previewLr")}</p>
              <p className="mono-num font-semibold" dir="ltr">
                53.2 / 46.8
              </p>
            </div>
            <div className="rounded-lg bg-[var(--color-secondary)] px-3 py-2">
              <p className="text-[var(--color-subtext)]">{t("previewCeiling")}</p>
              <p className="font-semibold">{t("previewPsaBand")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

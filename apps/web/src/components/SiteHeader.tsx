import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const other = locale === "en" ? "ar" : "en";

  return (
    <header
      className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white"
      data-testid="site-header"
    >
      <div className="page-shell flex h-[var(--header-h)] items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/brand/mynted-logo.png"
            alt="MYNTED"
            width={140}
            height={30}
            priority
            className="h-7 w-auto object-contain sm:h-8"
          />
          <span className="hidden h-5 w-px bg-[var(--color-border)] sm:block" aria-hidden />
          <span className="hidden text-sm font-semibold tracking-wide text-[var(--color-text)] sm:inline">
            {t("scan")}
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link
            href="/scan"
            className="rounded-[var(--radius)] px-2.5 py-1.5 font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-secondary)]"
          >
            {t("scan")}
          </Link>
          {signedIn ? (
            <Link
              href="/history"
              className="hidden rounded-[var(--radius)] px-2.5 py-1.5 font-medium hover:bg-[var(--color-secondary)] sm:inline"
            >
              {t("history")}
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="hidden rounded-[var(--radius)] px-2.5 py-1.5 font-medium hover:bg-[var(--color-secondary)] sm:inline"
            >
              {t("signIn")}
            </Link>
          )}
          <Link
            href="/"
            locale={other}
            className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtext)]"
          >
            {other}
          </Link>
          <a
            href="https://mynted.me/"
            className="btn-ink ms-1 hidden whitespace-nowrap sm:inline-flex"
          >
            {t("backShort")}
          </a>
        </nav>
      </div>
    </header>
  );
}

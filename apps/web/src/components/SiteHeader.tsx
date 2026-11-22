import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const other = locale === "en" ? "ar" : "en";

  return (
    <header className="border-b border-black/5 bg-[var(--color-chrome)] text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/mynted-logo.svg"
            alt="MYNTED"
            width={112}
            height={28}
            priority
            className="h-7 w-auto"
          />
          <span className="text-sm font-semibold tracking-wide text-white/90">
            Scan
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/scan" className="hover:underline">
            {t("scan")}
          </Link>
          {signedIn ? (
            <Link href="/history" className="hover:underline">
              {t("history")}
            </Link>
          ) : (
            <Link href="/sign-in" className="hover:underline">
              {t("signIn")}
            </Link>
          )}
          <Link
            href="/"
            locale={other}
            className="rounded-[var(--radius)] border border-white/30 px-2 py-1 text-xs uppercase"
          >
            {other}
          </Link>
          <a
            href="https://mynted.me/"
            className="hidden text-xs text-white/70 hover:text-white sm:inline"
          >
            {t("backToMynted")}
          </a>
        </nav>
      </div>
    </header>
  );
}
"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const other = locale === "en" ? "ar" : "en";
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const onSwitch = () => {
    const query = Object.fromEntries(searchParams.entries());
    router.replace(
      { pathname, query },
      { locale: other },
    );
  };

  return (
    <button
      type="button"
      onClick={onSwitch}
      data-testid="locale-switcher"
      className="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtext)]"
    >
      {other}
    </button>
  );
}

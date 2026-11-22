"use client";

import { House, Camera, ClockCounterClockwise, Storefront } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export function MobileTabBar({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" },
    { href: "/scan", label: t("scan"), icon: Camera, match: (p: string) => p.startsWith("/scan") },
    {
      href: signedIn ? "/history" : "/sign-in",
      label: signedIn ? t("history") : t("signIn"),
      icon: ClockCounterClockwise,
      match: (p: string) => p.startsWith("/history") || p.startsWith("/sign-"),
    },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-white/95 backdrop-blur-md md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium ${
                  active ? "text-[var(--color-cta)]" : "text-[var(--color-subtext)]"
                }`}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <a
            href="https://mynted.me/"
            className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-[var(--color-subtext)]"
          >
            <Storefront size={22} />
            <span>Shop</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}
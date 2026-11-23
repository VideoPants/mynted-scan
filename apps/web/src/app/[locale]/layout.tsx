import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { MobileTabBar } from "@/components/MobileTabBar";
import { Providers } from "@/components/Providers";
import { RegisterPWA } from "@/components/RegisterPWA";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "en" | "ar")) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();
  const session = await auth();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const signedIn = Boolean(session?.user);

  return (
    <html lang={locale} dir={dir}>
      <body className="site-atmosphere flex min-h-[100dvh] flex-col antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <RegisterPWA />
            <SiteHeader signedIn={signedIn} />
            <main className="page-shell w-full flex-1 py-6 md:py-8">{children}</main>
            <SiteFooter />
            <MobileTabBar signedIn={signedIn} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
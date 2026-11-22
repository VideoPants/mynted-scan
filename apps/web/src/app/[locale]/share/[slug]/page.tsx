import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ResultsView } from "@/components/ResultsView";
import { prisma } from "@/lib/prisma";
import { reportFromScan } from "@/lib/scan-mapper";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "MyntedScan shared report",
    openGraph: {
      title: "MyntedScan centering report",
      description: "Read-only centering ceiling report",
      images: [`/api/og/${slug}`],
    },
    robots: { index: true, follow: false },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("share");

  const link = await prisma.shareLink.findUnique({
    where: { slug },
    include: { scan: { include: { faces: true } } },
  });
  if (!link || link.revokedAt) {
    return <p>{t("revoked")}</p>;
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const report = reportFromScan(link.scan, `${base}/${locale}/share/${slug}`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <ResultsView initialReport={report} readOnly />
    </div>
  );
}
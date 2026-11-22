import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ResultsView } from "@/components/ResultsView";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportFromScan } from "@/lib/scan-mapper";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);

  const scan = await prisma.scan.findFirst({
    where: { id, userId: session.user.id },
    include: { faces: true },
  });
  if (!scan) notFound();

  return <ResultsView initialReport={reportFromScan(scan)} />;
}
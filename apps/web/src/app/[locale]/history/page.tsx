import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HistoryActions } from "@/components/HistoryActions";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("history");
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in`);
  }

  const scans = await prisma.scan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { faces: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {scans.length === 0 ? (
        <p className="text-[var(--color-subtext)]">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-black/10">
          {scans.map((scan) => (
            <li key={scan.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">{scan.title ?? scan.name ?? "Scan"}</p>
                <p className="text-xs text-[var(--color-subtext)]">
                  {scan.createdAt.toISOString().slice(0, 10)} · {scan.faces.length} face(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/history/${scan.id}`} className="btn-secondary">
                  {t("open")}
                </Link>
                <HistoryActions id={scan.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
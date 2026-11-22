import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { ScanCapture } from "@/components/ScanCapture";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ScanCapture />
    </Suspense>
  );
}
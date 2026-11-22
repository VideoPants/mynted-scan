import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DevLabelTool } from "@/components/DevLabelTool";

export default async function DevLabelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DevLabelTool />;
}
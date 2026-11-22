import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportFromScan } from "@/lib/scan-mapper";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const link = await prisma.shareLink.findUnique({
    where: { slug },
    include: { scan: { include: { faces: true } } },
  });
  if (!link || link.revokedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const report = reportFromScan(link.scan, `${base}/en/share/${slug}`);
  return NextResponse.json(report);
}
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const link = await prisma.shareLink.findUnique({
    where: { slug },
    include: { scan: true },
  });
  if (!link || link.scan.userId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await prisma.shareLink.update({
    where: { slug },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
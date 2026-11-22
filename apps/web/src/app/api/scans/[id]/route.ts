import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportFromScan } from "@/lib/scan-mapper";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const scan = await prisma.scan.findFirst({
    where: { id, userId: session.user.id },
    include: { faces: true },
  });
  if (!scan) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ scan, report: reportFromScan(scan) });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json();
  const scan = await prisma.scan.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!scan) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.scan.update({
    where: { id },
    data: {
      title: body.title ?? scan.title,
      cardId: body.cardId ?? scan.cardId,
      setId: body.setId ?? scan.setId,
      setName: body.setName ?? scan.setName,
      number: body.number ?? scan.number,
      name: body.name ?? scan.name,
      imageUrl: body.imageUrl ?? scan.imageUrl,
      identitySource: "USER",
    },
    include: { faces: true },
  });
  return NextResponse.json({ scan: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const scan = await prisma.scan.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!scan) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await prisma.scan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
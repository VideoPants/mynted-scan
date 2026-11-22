import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  target: z.literal("setline"),
  externalListingId: z.string().min(1),
});

export async function POST(
  req: Request,
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

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const attachment = await prisma.listingAttachment.create({
    data: {
      scanId: id,
      target: parsed.data.target,
      externalListingId: parsed.data.externalListingId,
    },
  });
  return NextResponse.json({ attachment });
}
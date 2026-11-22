import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { CenteringReportSchema, ALGORITHM_VERSION } from "@mynted/centering-core";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unguessableSlug } from "@/lib/slug";

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CenteringReportSchema.safeParse(body.report);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_report", details: parsed.error.flatten() }, { status: 400 });
  }
  const report = parsed.data;
  const wantShare = Boolean(body.share);

  const scan = await prisma.scan.create({
    data: {
      userId: session.user.id,
      title: report.card.name ?? "Scan",
      algorithmVersion: report.algorithmVersion || ALGORITHM_VERSION,
      cardId: report.card.cardId,
      setId: report.card.setId,
      setName: report.card.setName,
      number: report.card.number,
      name: report.card.name,
      imageUrl: report.card.imageUrl,
      identitySource: report.card.identitySource,
      identityConfidence: report.card.identityConfidence,
      faces: {
        create: report.faces.map((f) => ({
          face: f.face,
          status: f.status,
          borderL: f.bordersMm.L,
          borderR: f.bordersMm.R,
          borderT: f.bordersMm.T,
          borderB: f.bordersMm.B,
          lrRatio: f.lrRatio.raw,
          tbRatio: f.tbRatio.raw,
          uncertaintyLr: f.uncertaintyPp.lr,
          uncertaintyTb: f.uncertaintyPp.tb,
          confidence: f.confidence,
          printSkewDeg: f.printSkewDeg,
          framesUsed: f.framesUsed,
          captureSource: f.captureSource,
          qualityJson: asJson(f.quality),
          linesJson: asJson(f.lines),
          manualAdjusted: f.manualAdjusted,
        })),
      },
    },
  });

  let shareUrl: string | undefined;
  if (wantShare) {
    const slug = unguessableSlug();
    await prisma.shareLink.create({
      data: { scanId: scan.id, slug },
    });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    shareUrl = `${base}/en/share/${slug}`;
  }

  return NextResponse.json({ id: scan.id, shareUrl });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const scans = await prisma.scan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { faces: true },
  });
  return NextResponse.json({ scans });
}
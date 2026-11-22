import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const link = await prisma.shareLink.findUnique({
    where: { slug },
    include: { scan: true },
  });
  const title = link?.scan.name ?? "MyntedScan report";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#131921",
          color: "white",
          padding: 64,
          fontSize: 48,
        }}
      >
        <div style={{ color: "#0071E3", fontSize: 28 }}>MYNTED Scan</div>
        <div style={{ marginTop: 16 }}>{title}</div>
        <div style={{ marginTop: 24, fontSize: 24, color: "#9fa0a0" }}>
          Centering ceiling report
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
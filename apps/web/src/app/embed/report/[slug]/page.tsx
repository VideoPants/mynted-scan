import { prisma } from "@/lib/prisma";
import { reportFromScan } from "@/lib/scan-mapper";
import { formatRatioPair } from "@mynted/centering-core";

export default async function EmbedReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await prisma.shareLink.findUnique({
    where: { slug },
    include: { scan: { include: { faces: true } } },
  });
  if (!link || link.revokedAt) {
    return (
      <html>
        <body style={{ fontFamily: "Roboto, sans-serif", padding: 16 }}>
          Unavailable
        </body>
      </html>
    );
  }
  const report = reportFromScan(link.scan);
  const front = report.faces.find((f) => f.face === "FRONT");

  return (
    <html>
      <body
        style={{
          margin: 0,
          fontFamily: "Roboto, sans-serif",
          color: "#0f1111",
          background: "#fff",
          padding: 16,
        }}
      >
        <div style={{ border: "1px solid #ededed", borderRadius: 16, padding: 16 }}>
          <strong>MyntedScan</strong>
          {report.card.name && (
            <p style={{ margin: "8px 0" }}>
              {report.card.name} · {report.card.setName} · #{report.card.number}
            </p>
          )}
          {front && (
            <p style={{ fontFamily: "Roboto Mono, monospace" }}>
              LR {formatRatioPair(front.lrRatio)} · TB {formatRatioPair(front.tbRatio)}
            </p>
          )}
          <p style={{ fontSize: 12, color: "#5c5f5f" }}>
            Centering ceiling only — not a full grade.
          </p>
        </div>
      </body>
    </html>
  );
}
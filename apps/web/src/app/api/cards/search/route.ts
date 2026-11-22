import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ cards: [] });
  }

  const base = process.env.TCGDEX_API_BASE ?? "https://api.tcgdex.net/v2/en";
  try {
    const url = `${base}/cards?name=${encodeURIComponent(q)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ cards: [] });
    }
    const data = (await res.json()) as Array<{
      id: string;
      name: string;
      localId: string;
      image?: string;
    }>;
    const cards = (Array.isArray(data) ? data : []).slice(0, 20).map((c) => ({
      id: c.id,
      name: c.name,
      localId: c.localId,
      set: { id: c.id.split("-")[0] ?? "", name: c.id.split("-")[0] ?? "" },
      image: c.image ? `${c.image}/low.webp` : undefined,
    }));
    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ cards: [] });
  }
}
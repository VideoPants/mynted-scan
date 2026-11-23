import { NextResponse } from "next/server";

type TcgCard = {
  id: string;
  name: string;
  localId: string;
  image?: string;
  set?: { id?: string; name?: string };
};

const setNameCache = new Map<string, { name: string; expires: number }>();
const SET_TTL_MS = 1000 * 60 * 60 * 12;

async function resolveSetName(base: string, setId: string): Promise<string> {
  const cached = setNameCache.get(setId);
  if (cached && cached.expires > Date.now()) return cached.name;
  try {
    const res = await fetch(`${base}/sets/${encodeURIComponent(setId)}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { name?: string };
      const name = data.name?.trim() || setId;
      setNameCache.set(setId, { name, expires: Date.now() + SET_TTL_MS });
      return name;
    }
  } catch {
    /* fall through */
  }
  setNameCache.set(setId, { name: setId, expires: Date.now() + SET_TTL_MS });
  return setId;
}

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
    const data = (await res.json()) as TcgCard[];
    const raw = Array.isArray(data) ? data : [];
    const seen = new Set<string>();
    const unique = raw.filter((c) => {
      const key = `${c.name}|${c.localId}|${c.set?.id ?? c.id.split("-")[0]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const cards = await Promise.all(
      unique.slice(0, 20).map(async (c) => {
        const setId = c.set?.id ?? c.id.split("-")[0] ?? "";
        const setName =
          c.set?.name && c.set.name !== setId
            ? c.set.name
            : await resolveSetName(base, setId);
        return {
          id: c.id,
          name: c.name,
          localId: c.localId,
          set: { id: setId, name: setName },
          image: c.image ? `${c.image}/low.webp` : undefined,
        };
      }),
    );
    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ cards: [] });
  }
}

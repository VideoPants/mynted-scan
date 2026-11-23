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

/** Readable fallbacks when TCGdex returns only a short set code. */
const KNOWN_SET_NAMES: Record<string, string> = {
  tk: "Trainer Kit",
  base1: "Base Set",
  base2: "Base Set 2",
  base3: "Fossil",
  base4: "Base Set 2",
  base5: "Team Rocket",
  swsh1: "Sword & Shield",
  swsh2: "Rebel Clash",
  swsh3: "Darkness Ablaze",
};

function humanizeSetId(setId: string): string {
  const known = KNOWN_SET_NAMES[setId.toLowerCase()];
  if (known) return known;
  return setId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displaySetName(setId: string, resolved?: string | null): string {
  const name = resolved?.trim();
  if (name && name.toLowerCase() !== setId.toLowerCase()) return name;
  return humanizeSetId(setId);
}

async function resolveSetName(base: string, setId: string): Promise<string> {
  const cached = setNameCache.get(setId);
  if (cached && cached.expires > Date.now()) return cached.name;
  try {
    const res = await fetch(`${base}/sets/${encodeURIComponent(setId)}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { name?: string };
      const name = displaySetName(setId, data.name);
      setNameCache.set(setId, { name, expires: Date.now() + SET_TTL_MS });
      return name;
    }
  } catch {
    /* fall through */
  }
  const name = displaySetName(setId);
  setNameCache.set(setId, { name, expires: Date.now() + SET_TTL_MS });
  return name;
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
          c.set?.name && c.set.name.toLowerCase() !== setId.toLowerCase()
            ? displaySetName(setId, c.set.name)
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

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export interface PickedCard {
  cardId: string | null;
  setId: string | null;
  setName: string | null;
  number: string | null;
  name: string | null;
  imageUrl: string | null;
}

interface SearchHit {
  id: string;
  name: string;
  localId: string;
  set?: { id: string; name: string };
  image?: string;
}

export function CardPicker({
  onSelect,
  onClose,
}: {
  onSelect: (card: PickedCard) => void;
  onClose: () => void;
}) {
  const t = useTranslations("cardPicker");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { cards: SearchHit[] };
      setHits(data.cards ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-[var(--radius)] bg-white p-5">
        <h2 className="text-xl font-bold">{t("title")}</h2>
        <p className="text-sm text-[var(--color-subtext)]">{t("optional")}</p>
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("placeholder")}
            className="flex-1 rounded-[var(--radius)] border border-black/15 px-3 py-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
          />
          <button type="button" className="btn-primary" onClick={() => void search()}>
            {t("search")}
          </button>
        </div>
        {loading && <p className="mt-3 text-sm">…</p>}
        {!loading && hits.length === 0 && <p className="mt-3 text-sm">{t("empty")}</p>}
        <ul className="mt-3 divide-y divide-black/5">
          {hits.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 py-3 text-left hover:bg-[var(--color-secondary)]"
                onClick={() =>
                  onSelect({
                    cardId: card.id,
                    setId: card.set?.id ?? null,
                    setName: card.set?.name ?? null,
                    number: card.localId,
                    name: card.name,
                    imageUrl: card.image ?? null,
                  })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {card.image ? (
                  <img src={card.image} alt="" className="h-14 w-10 object-cover" />
                ) : (
                  <div className="h-14 w-10 bg-[var(--color-secondary)]" />
                )}
                <span>
                  <span className="block font-medium">{card.name}</span>
                  <span className="text-xs text-[var(--color-subtext)]">
                    {card.set?.name} · {card.localId}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-secondary mt-4" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
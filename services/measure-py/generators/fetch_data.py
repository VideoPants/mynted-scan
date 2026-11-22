from __future__ import annotations

import argparse
import json
import time
from datetime import date
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw" / "official"
SOURCES = ROOT / "data" / "sources.json"


DEFAULT_SETS = ["sv8", "sv7", "sv6", "sv5"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=12)
    parser.add_argument("--sets", type=str, default=",".join(DEFAULT_SETS))
    args = parser.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    tcgdex = "https://api.tcgdex.net/v2/en"
    sources = []
    downloaded = 0

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        for set_id in [s.strip() for s in args.sets.split(",") if s.strip()]:
            if downloaded >= args.limit:
                break
            try:
                resp = client.get(f"{tcgdex}/sets/{set_id}")
                if resp.status_code != 200:
                    print(f"skip set {set_id}: {resp.status_code}")
                    continue
                cards = resp.json().get("cards") or []
            except Exception as exc:  # noqa: BLE001
                print(f"skip set {set_id}: {exc}")
                continue

            for card in cards:
                if downloaded >= args.limit:
                    break
                card_id = card.get("id")
                if not card_id:
                    continue
                img_url = f"https://assets.tcgdex.net/en/{set_id}/{card.get('localId')}/high.webp"
                dest = RAW / f"{card_id}.webp"
                if dest.exists():
                    downloaded += 1
                    continue
                try:
                    img = client.get(img_url)
                    if img.status_code != 200:
                        continue
                    dest.write_bytes(img.content)
                    downloaded += 1
                    time.sleep(0.15)
                except Exception as exc:  # noqa: BLE001
                    print(f"fail {card_id}: {exc}")

            sources.append(
                {
                    "id": f"tcgdex-{set_id}",
                    "url": f"{tcgdex}/sets/{set_id}",
                    "licence": "TCGdex DB MIT; card artwork © The Pokémon Company (reference-only, verify before commercial use)",
                    "downloadedOn": str(date.today()),
                    "count": downloaded,
                    "permittedUse": "local evaluation / augmentation only; do not redistribute images",
                }
            )

    # Real-photo datasets: document search; skip if no permissive public set without tokens
    real_note = {
        "id": "real-photo-search",
        "url": "https://huggingface.co/datasets",
        "licence": "n/a",
        "downloadedOn": str(date.today()),
        "count": 0,
        "permittedUse": "skipped — no tokenless CC0/CC-BY Pokémon card photo dataset auto-selected in this run",
        "skipped": True,
    }
    sources.append(real_note)
    SOURCES.write_text(json.dumps(sources, indent=2))
    print(f"Downloaded {downloaded} official images to {RAW}")
    print(f"Wrote {SOURCES}")


if __name__ == "__main__":
    main()
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

from app.measure import measure

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw" / "official"
OUT = ROOT / "data" / "generated" / "augmented"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=8)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    images = sorted(RAW.glob("*.webp"))[: args.limit]
    if not images:
        print("No official images; run generators.fetch_data first")
        return

    for i, path in enumerate(images):
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if img is None:
            continue
        base = measure(img, face="FRONT")
        if base["status"] == "UNSUPPORTED":
            continue
        # Known shift: extend left border conceptually by cropping right
        shift_mm = 0.4
        h, w = img.shape[:2]
        px = int(shift_mm * (w / 63.0))
        cropped = img[:, px:] if px > 0 else img
        cropped = cv2.resize(cropped, (w, h))
        noise = cropped.astype(np.float32)
        noise += np.random.default_rng(i).normal(0, 4, noise.shape)
        out_img = np.clip(noise, 0, 255).astype(np.uint8)
        stem = f"aug_{i:03d}"
        cv2.imwrite(str(OUT / f"{stem}.png"), out_img)
        gt = {
            "gtType": "augmented",
            "source": path.name,
            "shiftMm": {"L": shift_mm, "R": -shift_mm, "T": 0, "B": 0},
            "baseBordersMm": base["bordersMm"],
            "bordersMm": {
                "L": base["bordersMm"]["L"] + shift_mm,
                "R": max(0.1, base["bordersMm"]["R"] - shift_mm),
                "T": base["bordersMm"]["T"],
                "B": base["bordersMm"]["B"],
            },
        }
        L, R = gt["bordersMm"]["L"], gt["bordersMm"]["R"]
        gt["lrRatio"] = max(L, R) / (L + R) * 100
        (OUT / f"{stem}.json").write_text(json.dumps(gt, indent=2))
    print(f"Wrote augmented samples under {OUT}")


if __name__ == "__main__":
    main()
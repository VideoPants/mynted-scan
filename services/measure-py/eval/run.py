from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

from app.measure import measure

ROOT = Path(__file__).resolve().parents[3]


def load_samples(set_name: str, split: str) -> list[tuple[Path, dict]]:
    if set_name == "synthetic":
        folder = ROOT / "data" / "generated" / "synthetic" / split
    elif set_name == "augmented":
        folder = ROOT / "data" / "generated" / "augmented"
    elif set_name == "real":
        folder = ROOT / "data" / "real"
    else:
        raise SystemExit(f"unknown set {set_name}")

    samples = []
    if set_name == "real":
        labels = ROOT / "data" / "labels" / "real.json"
        if not labels.exists():
            return []
        data = json.loads(labels.read_text())
        for item in data.get("items", []):
            img = ROOT / item["image"]
            if img.exists():
                samples.append((img, item))
        return samples

    for img in sorted(folder.glob("*.png")):
        meta = img.with_suffix(".json")
        if meta.exists():
            samples.append((img, json.loads(meta.read_text())))
    return samples


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", default="test")
    parser.add_argument("--set", dest="set_name", default="synthetic")
    args = parser.parse_args()

    samples = load_samples(args.set_name, args.split)
    if not samples:
        print(json.dumps({"set": args.set_name, "split": args.split, "n": 0, "note": "no samples"}))
        return

    errors = []
    rejects = 0
    for img_path, gt in samples:
        # Prefer clean unwarped sibling for exact-GT synthetic eval when present
        clean = img_path.with_name(img_path.stem + "_clean.png")
        path = clean if clean.exists() else img_path
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        result = measure(image, face="FRONT")
        if result["status"] in ("UNSUPPORTED",):
            rejects += 1
            continue
        gt_lr = gt.get("lrRatio")
        if gt_lr is None and "bordersMm" in gt:
            b = gt["bordersMm"]
            gt_lr = max(b["L"], b["R"]) / (b["L"] + b["R"]) * 100
        pred = result["lrRatio"]["raw"]
        if gt_lr is not None:
            errors.append(abs(pred - gt_lr))

    mae = float(np.mean(errors)) if errors else None
    p95 = float(np.percentile(errors, 95)) if errors else None
    out = {
        "set": args.set_name,
        "split": args.split,
        "n": len(samples),
        "evaluated": len(errors),
        "rejectRate": rejects / max(len(samples), 1),
        "mae_pp": mae,
        "p95_pp": p95,
        "gtType": samples[0][1].get("gtType", args.set_name),
    }
    print(json.dumps(out, indent=2))
    baseline_path = ROOT / "data" / "baselines" / f"{args.set_name}.json"
    baseline_path.parent.mkdir(parents=True, exist_ok=True)
    baseline_path.write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
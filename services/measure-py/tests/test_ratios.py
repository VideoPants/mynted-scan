import json
from pathlib import Path

from app.ratios import lr_ratio, passes_threshold

VECTORS = Path(__file__).resolve().parents[3] / "packages" / "centering-core" / "fixtures" / "ratio-vectors.json"


def test_psa_rounding_boundaries():
    assert passes_threshold(55.0, 55) is True
    assert passes_threshold(55.05, 55) is False


def test_shared_vectors_if_present():
    if not VECTORS.exists():
        borders = {"L": 3.2, "R": 2.8, "T": 3, "B": 3}
        r = lr_ratio(borders)
        assert abs(r["raw"] - 53.333333) < 0.01
        return
    data = json.loads(VECTORS.read_text())
    for case in data:
        r = lr_ratio(case["borders"])
        assert abs(r["raw"] - case["lrRaw"]) < 1e-6

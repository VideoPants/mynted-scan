from __future__ import annotations

from typing import Literal


def axis_ratio(
    a: float,
    b: float,
    wider_when_a: Literal["L", "T"],
    wider_when_b: Literal["R", "B"],
) -> dict:
    total = a + b
    if total <= 0:
        return {"larger": 50.0, "smaller": 50.0, "wider": wider_when_a, "raw": 50.0}
    raw_larger = (max(a, b) / total) * 100.0
    wider = wider_when_a if a >= b else wider_when_b
    return {
        "larger": round(raw_larger * 10) / 10,
        "smaller": round((100 - raw_larger) * 10) / 10,
        "wider": wider,
        "raw": raw_larger,
    }


def lr_ratio(borders: dict) -> dict:
    return axis_ratio(borders["L"], borders["R"], "L", "R")


def tb_ratio(borders: dict) -> dict:
    return axis_ratio(borders["T"], borders["B"], "T", "B")


def passes_threshold(raw_larger: float, max_allowed: float | None) -> bool:
    if max_allowed is None:
        return False
    return raw_larger <= max_allowed
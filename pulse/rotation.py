"""F.O.C.U.S. relative rotation: our own RS-Ratio / RS-Momentum, a public approximation of
the Relative Rotation Graph idea (the JdK formulas behind SSGA / Optuma / StockCharts RRG are
proprietary, so values and tails will not match theirs point for point; quadrants and
direction usually agree, which is what to compare them on).

For each symbol against a benchmark (SPY):
  rs        = 100 * close / benchmark close, smoothed by a 5-period EMA
  rs_ratio  = 100 + 2 x z-score of rs over the last 40 periods        (trend of relative strength)
  rs_mom    = 100 + 2 x z-score of rs_ratio over the last 20 periods  (its rate of change)
on weekly closes (the last close of each week; the current week so far counts) or daily
closes. Chosen 2026-10-05 against SSGA's weekly sector RRG of 2026-10-01: of several standard
formulations (10-week z-scores, EMA-ratio "MACD" styles, 26 / 52 / 65-week windows) this one
matched 7 of 10 SSGA quadrants (a 10-week version matched 2) with RS-Ratio values within about
a point (XLY 96.3 vs 96.4, XLB 96.6 vs 96.7, XLK 102.9 vs 103.7); the misses sat near
momentum 100. One date only: a close cousin of the official chart, not a copy. Quadrants: Leading (ratio >= 100, momentum >= 100), Weakening (ratio >= 100,
momentum < 100), Lagging (both < 100), Improving (ratio < 100, momentum >= 100). Rotation
usually runs clockwise: Improving -> Leading -> Weakening -> Lagging.
"""
from __future__ import annotations

import math
from datetime import date
from typing import Iterable, Optional

SECTOR_ETFS: dict[str, str] = {
    "XLK": "Technology", "XLF": "Financials", "XLV": "Health Care", "XLE": "Energy",
    "XLI": "Industrials", "XLY": "Consumer Discretionary", "XLP": "Consumer Staples",
    "XLU": "Utilities", "XLB": "Materials", "XLRE": "Real Estate", "XLC": "Communication Services",
}
# Yahoo's sector names (fundamentals cache) -> the SPDR sector ETF
YAHOO_SECTOR_ETF: dict[str, str] = {
    "Technology": "XLK", "Financial Services": "XLF", "Healthcare": "XLV", "Energy": "XLE",
    "Industrials": "XLI", "Consumer Cyclical": "XLY", "Consumer Defensive": "XLP", "Utilities": "XLU",
    "Basic Materials": "XLB", "Real Estate": "XLRE", "Communication Services": "XLC",
}
QUADRANTS = ("Leading", "Weakening", "Lagging", "Improving")


def quadrant(ratio: float, mom: float) -> str:
    if ratio >= 100:
        return "Leading" if mom >= 100 else "Weakening"
    return "Improving" if mom >= 100 else "Lagging"


def weekly(series: Iterable[tuple[date, float]]) -> list[tuple[date, float]]:
    """Last close of each ISO week (dated by that last trading day)."""
    out: dict[tuple[int, int], tuple[date, float]] = {}
    for d, c in sorted(series):
        out[d.isocalendar()[:2]] = (d, c)
    return [out[k] for k in sorted(out)]


def _ema(xs: list[float], n: int) -> list[float]:
    k, out = 2 / (n + 1), []
    for x in xs:
        out.append(x if not out else out[-1] + k * (x - out[-1]))
    return out


def _z_last(window: list[float]) -> Optional[float]:
    m = sum(window) / len(window)
    sd = math.sqrt(sum((x - m) ** 2 for x in window) / (len(window) - 1)) if len(window) > 1 else 0.0
    return (window[-1] - m) / sd if sd > 0 else 0.0


RATIO_N, MOM_N, SMOOTH, SCALE = 40, 20, 5, 2.0


def rrg_points(px: list[tuple[date, float]], bench: list[tuple[date, float]], n: int = RATIO_N,
               m: int = MOM_N, smooth: int = SMOOTH, k: float = SCALE) -> list[tuple[date, float, float]]:
    """[(date, rs_ratio, rs_momentum)] on the dates both series share, oldest first;
    the first n + m - 2 periods have no value (not returned)."""
    b = dict(bench)
    common = [(d, c, b[d]) for d, c in px if d in b and c > 0 and b[d] > 0]
    if len(common) < n + m:
        return []
    rs = _ema([100 * c / bc for _, c, bc in common], smooth)
    ratio: list[Optional[float]] = [None] * len(rs)
    for i in range(n - 1, len(rs)):
        ratio[i] = 100 + k * (_z_last(rs[i - n + 1:i + 1]) or 0.0)
    out = []
    for i in range(n + m - 2, len(rs)):
        win = [r for r in ratio[i - m + 1:i + 1] if r is not None]
        if len(win) < m:
            continue
        out.append((common[i][0], round(ratio[i], 3), round(100 + k * (_z_last(win) or 0.0), 3)))
    return out


def rotation(closes: dict[str, list[tuple[date, float]]], bench: str = "SPY", tf: str = "W",
             tail: int = 10) -> dict[str, dict]:
    """{symbol: {"quadrant", "ratio", "mom", "points": [[iso date, ratio, mom], ...] (last `tail`)}}
    for every symbol in `closes` except the benchmark; symbols without enough history are left out."""
    b = closes.get(bench) or []
    if tf == "W":
        b = weekly(b)
    out: dict[str, dict] = {}
    for sym, px in closes.items():
        if sym == bench:
            continue
        pts = rrg_points(weekly(px) if tf == "W" else sorted(px), b)
        if not pts:
            continue
        d, r, m = pts[-1]
        out[sym] = {"quadrant": quadrant(r, m), "ratio": r, "mom": m,
                    "points": [[x.isoformat(), y, z] for x, y, z in pts[-max(1, tail):]]}
    return out

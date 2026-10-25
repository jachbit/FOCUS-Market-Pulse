"""F.O.C.U.S. Market Weather: is the market wind at my back?

Five parts, one verdict:
1. VIX in context: level band (<15 calm, 15-20 cautious, 20-30 fear, >30 panic), direction
   (against its 10-day average), 1-year percentile, and term structure VIX / VIX3M (below 1 =
   contango, normal; above 1 = backwardation, stress now). VIX9D shown alongside.
2. Breadth of the scanner's own universe: % above the 20 / 50 / 200-day averages, advancers vs
   decliners, new 52-week highs vs lows, and a divergence warning (SPY near its high while
   participation is weak: a narrow market).
3. Score 0-100 from SPY's trend, breadth, VIX and how many sectors are Leading / Improving
   (our rotation): 70+ Clear (risk-on), 40-70 Mixed (selective), under 40 Stormy (defensive).
4. An options hint from VIX level, direction and term structure.
6. Rates & credit: the 10-year Treasury yield ($TNX) and its 20-day change (a fast rise is a
   headwind for growth / tech, real estate, utilities; financials benefit), the 10-year minus
   3-month curve ($IRX; inverted = a classic recession warning), credit appetite as HYG / IEF
   against its 20-day average (falling = risk-off, often early), and the dollar (UUP, 20-day).
5. The score for each of the last 60 sessions (history; the sector part is today only).

Pure functions: prices come in, nothing is fetched here (the API feeds it the scanner's daily
history, live prices, and Schwab's $VIX / $VIX3M / $VIX9D dailies).
"""
from __future__ import annotations

import math
from datetime import date
from typing import Optional

import pandas as pd

# component: weight (points out of 100); a missing component's weight is spread over the rest
WEIGHTS = {"spy_trend": 20, "above50": 15, "above200": 10, "above20": 5, "advancers": 10,
           "highs_lows": 10, "vix_level": 10, "vix_dir": 5, "term": 10, "sectors": 5,
           "rates": 6, "credit": 6, "dollar": 3}
LABELS = {"spy_trend": "SPY trend (above 20 / 50 / 200-day)", "above50": "% of stocks above 50-day",
          "above200": "% above 200-day", "above20": "% above 20-day", "advancers": "Advancers today",
          "highs_lows": "New highs vs lows", "vix_level": "VIX level", "vix_dir": "VIX direction (vs 10-day)",
          "term": "VIX term structure (VIX / VIX3M)", "sectors": "Sectors Leading / Improving",
          "rates": "10-year yield, 20-day change", "credit": "Credit appetite (HYG / IEF vs 20-day)",
          "dollar": "Dollar (UUP), 20-day change"}


def _lin(v: float, pts: list[tuple[float, float]]) -> float:
    """Piecewise-linear score through (x, score) points (x ascending), flat outside."""
    if v <= pts[0][0]:
        return float(pts[0][1])
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if v <= x1:
            return y0 + (y1 - y0) * (v - x0) / (x1 - x0)
    return float(pts[-1][1])


def _yield(v: float) -> float:
    """CBOE yield indexes ($TNX, $IRX) are quoted as yield x 10 (53.1 = 5.31%)."""
    return v / 10 if v > 20 else v


def vix_band(v: Optional[float]) -> Optional[str]:
    if v is None:
        return None
    return "Calm" if v < 15 else "Cautious" if v < 20 else "Fear" if v < 30 else "Panic"


def _vix_level_score(v: float) -> float:
    # 12 -> 100, 15 -> 85, 20 -> 55, 30 -> 15, 40+ -> 0 (piecewise linear)
    pts = [(12, 100), (15, 85), (20, 55), (30, 15), (40, 0)]
    if v <= pts[0][0]:
        return 100.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if v <= x1:
            return y0 + (y1 - y0) * (v - x0) / (x1 - x0)
    return 0.0


def _term_score(r: float) -> float:
    # VIX / VIX3M: 0.85 or lower -> 100 (calm contango), 1.0 -> 40, 1.1+ -> 0 (stress)
    if r <= 0.85:
        return 100.0
    if r <= 1.0:
        return 100 - (r - 0.85) / 0.15 * 60
    return max(0.0, 40 - (r - 1.0) / 0.1 * 40)


def weather(score: Optional[float]) -> dict:
    if score is None:
        return {"name": None, "icon": None, "size": None}
    if score >= 70:
        return {"name": "Clear", "icon": "☀", "size": "Full size on ✓ setups; long bias"}
    if score >= 40:
        return {"name": "Mixed", "icon": "⛅", "size": "Half size; only ✓ alerts with green IV/HV"}
    return {"name": "Stormy", "icon": "⛈", "size": "Quarter size or cash; short / hedge setups"}


def _frame(series: dict[str, list]) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """{sym: [(date, high, low, close)]} -> close, high, low matrices (dates x symbols)."""
    cols = {}
    for sym, rows in series.items():
        if rows:
            idx = [r[0] for r in rows]
            cols[sym] = pd.DataFrame({"h": [r[1] for r in rows], "l": [r[2] for r in rows], "c": [r[3] for r in rows]},
                                     index=pd.Index(idx))
    if not cols:
        empty = pd.DataFrame()
        return empty, empty, empty
    C = pd.DataFrame({s: d["c"] for s, d in cols.items()}).sort_index()
    H = pd.DataFrame({s: d["h"] for s, d in cols.items()}).sort_index()
    L = pd.DataFrame({s: d["l"] for s, d in cols.items()}).sort_index()
    return C, H, L


def breadth_table(series: dict[str, list]) -> pd.DataFrame:
    """Per date: above20 / above50 / above200 (% of stocks with that average), advancers (%),
    adv, dec, highs, lows (new 52-week highs / lows), n."""
    C, H, L = _frame(series)
    if C.empty:
        return pd.DataFrame()
    out = pd.DataFrame(index=C.index)
    for n in (20, 50, 200):
        sma = C.rolling(n, min_periods=n).mean()
        valid = sma.notna() & C.notna()
        out[f"above{n}"] = ((C > sma) & valid).sum(axis=1) / valid.sum(axis=1).replace(0, math.nan) * 100
    prev = C.shift(1)
    up, down = (C > prev) & prev.notna(), (C < prev) & prev.notna()
    out["adv"], out["dec"] = up.sum(axis=1), down.sum(axis=1)
    both = (out["adv"] + out["dec"]).replace(0, math.nan)
    out["advancers"] = out["adv"] / both * 100
    hi_prev = H.shift(1).rolling(251, min_periods=150).max()
    lo_prev = L.shift(1).rolling(251, min_periods=150).min()
    out["highs"] = ((H >= hi_prev) & hi_prev.notna()).sum(axis=1)
    out["lows"] = ((L <= lo_prev) & lo_prev.notna()).sum(axis=1)
    out["n"] = C.notna().sum(axis=1)
    return out


def spy_trend_table(spy: list[tuple[date, float]]) -> pd.DataFrame:
    s = pd.Series([c for _, c in spy], index=pd.Index([d for d, _ in spy])).sort_index()
    out = pd.DataFrame(index=s.index)
    out["close"] = s
    for n in (20, 50, 200):
        out[f"sma{n}"] = s.rolling(n, min_periods=n).mean()
    out["hi252"] = s.rolling(252, min_periods=150).max()
    return out


def _score_row(parts: dict[str, Optional[float]]) -> Optional[float]:
    have = {k: v for k, v in parts.items() if v is not None and not (isinstance(v, float) and math.isnan(v))}
    if not have:
        return None
    w = sum(WEIGHTS[k] for k in have)
    return round(float(sum(WEIGHTS[k] * have[k] for k in have) / w), 1)


def compute(stocks: dict[str, list], spy: list[tuple[date, float]], vix: list[tuple[date, float]],
            vix3m: list[tuple[date, float]], vix9d: Optional[list] = None,
            sectors: Optional[dict[str, str]] = None, history_days: int = 60,
            rates: Optional[dict[str, list]] = None) -> dict:
    """Today's weather plus the score history. `stocks` / `spy` / `vix*` include today's row
    when the session has data (live price as today's close)."""
    br = breadth_table(stocks)
    # a day counts for breadth only when most of the universe reports it (a partial cache
    # or the first minutes of a session must not decide "100% advancers" from 6 stocks)
    if not br.empty:
        br = br[br["n"] >= 0.6 * br["n"].max()]
    sp = spy_trend_table(spy) if spy else pd.DataFrame()
    vx = pd.Series({d: c for d, c in vix}).sort_index() if vix else pd.Series(dtype=float)
    v3 = pd.Series({d: c for d, c in vix3m}).sort_index() if vix3m else pd.Series(dtype=float)
    v9 = pd.Series({d: c for d, c in (vix9d or [])}).sort_index()
    rt = {k: pd.Series({d: c for d, c in (v or [])}).sort_index() for k, v in (rates or {}).items()}

    def at(series: pd.Series, d, back: int = 0) -> Optional[float]:
        """Value on or before d, `back` sessions earlier; None when there is not enough history."""
        if series is None or series.empty:
            return None
        upto = series.loc[:d]
        if len(upto) <= back:
            return None
        return float(upto.iloc[-1 - back])

    def parts_on(d, with_sectors: bool) -> tuple[dict, dict]:
        p: dict[str, Optional[float]] = {k: None for k in WEIGHTS}
        raw: dict = {}
        if d in sp.index:
            r = sp.loc[d]
            checks = [r["close"] > r[f"sma{n}"] for n in (20, 50, 200) if not math.isnan(r[f"sma{n}"])]
            if checks:
                p["spy_trend"] = 100 * sum(checks) / len(checks)
            raw["spy"] = {"close": round(float(r["close"]), 2),
                          **{f"sma{n}": (None if math.isnan(r[f"sma{n}"]) else round(float(r[f"sma{n}"]), 2)) for n in (20, 50, 200)},
                          "hi252": None if math.isnan(r["hi252"]) else round(float(r["hi252"]), 2)}
        bd = d if d in br.index else (br.index[br.index <= d].max() if len(br.index[br.index <= d]) else None)
        if bd is not None and (d - bd).days <= 5:
            b = br.loc[bd]
            for k in ("above20", "above50", "above200", "advancers"):
                p[k] = None if math.isnan(b[k]) else float(b[k])
            hl = b["highs"] + b["lows"]
            p["highs_lows"] = 100 * b["highs"] / hl if hl else 50.0
            raw["breadth"] = {k: (None if isinstance(b[k], float) and math.isnan(b[k]) else round(float(b[k]), 1))
                              for k in ("above20", "above50", "above200", "advancers", "adv", "dec", "highs", "lows", "n")}
            raw["breadth"]["asof"] = bd.isoformat()
        if d in vx.index:
            v = float(vx.loc[d])
            p["vix_level"] = _vix_level_score(v)
            hist = vx.loc[:d]
            avg10 = float(hist.tail(10).mean())
            p["vix_dir"] = max(0.0, min(100.0, 50 + (avg10 - v) / avg10 * 500))   # 10% below its average -> 100
            yr = hist.tail(252)
            raw["vix"] = {"vix": round(v, 2), "avg10": round(avg10, 2), "band": vix_band(v),
                          "pctile": round(100 * float((yr < v).sum()) / len(yr), 0) if len(yr) else None,
                          "dir": "falling" if v < avg10 * 0.97 else "rising" if v > avg10 * 1.03 else "flat"}
            if d in v3.index and float(v3.loc[d]) > 0:
                ratio = v / float(v3.loc[d])
                p["term"] = _term_score(ratio)
                raw["vix"].update(vix3m=round(float(v3.loc[d]), 2), ratio=round(ratio, 3),
                                  structure="backwardation (stress now)" if ratio > 1 else "contango (normal)")
            if d in v9.index:
                raw["vix"]["vix9d"] = round(float(v9.loc[d]), 2)
        # rates & credit
        tnx, tnx20, irx = at(rt.get("$TNX"), d), at(rt.get("$TNX"), d, 20), at(rt.get("$IRX"), d)
        if tnx is not None:
            y10 = _yield(tnx)
            chg_bp = None if tnx20 is None else round((y10 - _yield(tnx20)) * 100)
            if chg_bp is not None:
                # falling yields help stocks, a fast rise hurts: -15 bp -> 100, 0 -> 70, +30 -> 20, +50 -> 0
                p["rates"] = _lin(chg_bp, [(-15, 100), (0, 70), (15, 45), (30, 20), (50, 0)])
            raw["rates"] = {"y10": round(y10, 3), "chg20_bp": chg_bp,
                            "y3m": None if irx is None else round(_yield(irx), 3),
                            "curve": None if irx is None else round(y10 - _yield(irx), 3)}
        hyg, ief = rt.get("HYG"), rt.get("IEF")
        if hyg is not None and ief is not None and not hyg.empty and not ief.empty:
            ratio = (hyg / ief).dropna().loc[:d]
            if len(ratio) >= 20:
                dev = (float(ratio.iloc[-1]) / float(ratio.tail(20).mean()) - 1) * 100
                p["credit"] = _lin(dev, [(-2, 0), (-1, 30), (0, 60), (1, 100)])
                raw.setdefault("rates", {})["credit_dev"] = round(dev, 2)
        uup, uup20 = at(rt.get("UUP"), d), at(rt.get("UUP"), d, 20)
        if uup is not None and uup20:
            dchg = (uup / uup20 - 1) * 100
            p["dollar"] = _lin(dchg, [(-1.5, 100), (0, 70), (1.5, 40), (3, 10)])
            raw.setdefault("rates", {})["dollar_chg"] = round(dchg, 2)
        if with_sectors and sectors:
            good = sum(q in ("Leading", "Improving") for q in sectors.values())
            p["sectors"] = 100 * good / len(sectors)
            raw["sectors"] = {"good": good, "total": len(sectors),
                              "leading": sorted(k for k, q in sectors.items() if q == "Leading"),
                              "improving": sorted(k for k, q in sectors.items() if q == "Improving")}
        return p, raw

    dates = sorted(set(br.index) | set(sp.index) | set(vx.index))
    if not dates:
        return {"asof": None, "score": None, "error": "No market data yet"}
    today = dates[-1]
    parts, raw = parts_on(today, True)
    score = _score_row(parts)
    history = []
    for d in dates[-history_days:]:
        hp, _ = parts_on(d, False)
        s = _score_row(hp)
        if s is not None:
            history.append([d.isoformat(), float(s)])
    components = [{"key": k, "label": LABELS[k], "weight": WEIGHTS[k],
                   "score": None if parts[k] is None else round(parts[k], 1)} for k in WEIGHTS]

    # divergence: SPY within 1% of its 52-week high while participation is weak
    warnings = []
    spy_raw, b = raw.get("spy") or {}, raw.get("breadth") or {}
    if spy_raw.get("hi252") and spy_raw["close"] >= spy_raw["hi252"] * 0.99:
        if (b.get("above50") is not None and b["above50"] < 50) or (b.get("highs", 0) < b.get("lows", 0)):
            warnings.append(f"Narrow market: SPY is near its 52-week high but only {b.get('above50')}% of stocks are above "
                            f"their 50-day and new highs {b.get('highs')} vs lows {b.get('lows')}. Rallies led by a few "
                            "giants often stall: be selective.")
    r = raw.get("rates") or {}
    if (r.get("chg20_bp") or 0) >= 25:
        warnings.append(f"Rates rising fast: the 10-year yield is up {r['chg20_bp']} bp in 20 sessions (now {r['y10']:.2f}%). "
                        "Headwind for growth / tech, real estate and utilities; financials (XLF) tend to benefit.")
    elif (r.get("chg20_bp") or 0) <= -25:
        warnings.append(f"Rates falling fast: the 10-year yield is down {-r['chg20_bp']} bp in 20 sessions (now {r['y10']:.2f}%). "
                        "Tailwind for tech, real estate and utilities, but a sharp drop can also mean a growth scare.")
    if r.get("curve") is not None and r["curve"] < 0:
        warnings.append(f"Inverted yield curve: 10-year {r['y10']:.2f}% below 3-month {r['y3m']:.2f}%: historically a recession "
                        "warning (the stock damage often comes when it re-steepens).")
    if r.get("credit_dev") is not None and r["credit_dev"] <= -0.5 and spy_raw.get("hi252") and spy_raw["close"] >= spy_raw["hi252"] * 0.97:
        warnings.append(f"Credit weakening while stocks are near their highs: HYG / IEF {r['credit_dev']}% below its 20-day "
                        "average. Bond money often turns risk-off before stocks: be careful with new longs.")
    if (r.get("dollar_chg") or 0) >= 2:
        warnings.append(f"Dollar up {r['dollar_chg']}% in 20 sessions: tighter financial conditions; a headwind for "
                        "multinationals, commodities and emerging markets.")
    if (raw.get("vix") or {}).get("ratio", 0) > 1:
        warnings.append("VIX term structure is inverted (short-term VIX above 3-month): stress right now. "
                        "Often near panic lows, but size down until it flips back.")
    return {"asof": today.isoformat(), "score": score, "weather": weather(score), "components": components,
            "vix": raw.get("vix"), "breadth": b or None, "spy": spy_raw or None, "sectors": raw.get("sectors"),
            "rates": raw.get("rates"), "rates_hint": rates_hint(raw.get("rates")),
            "hint": options_hint(raw.get("vix")), "warnings": warnings, "history": history, "error": None}


def options_hint(v: Optional[dict]) -> Optional[str]:
    if not v:
        return None
    lvl, d, ratio = v["vix"], v["dir"], v.get("ratio") or 0
    if ratio > 1:
        return "Stress now (term structure inverted): premium is very rich. Sell premium only small, or wait; avoid paying up for calls."
    if lvl >= 20 and d == "rising":
        return "Fear building: premium rich and getting richer. CSP / CC only small and far out of the money; buyers pay up."
    if lvl >= 20:
        return "Fear easing from a high level: premium still rich. A good window for CSPs; calls are getting cheaper."
    if lvl < 15 and d != "rising":
        return "Calm and cheap options: favors buying calls / puts; selling premium pays little."
    if d == "rising":
        return "VIX rising from a normal level: tighten stops; premium sellers get paid a bit more."
    return "Normal volatility: let each stock's IV/HV color decide (green = favorable for your side)."


def rates_hint(r: Optional[dict]) -> Optional[str]:
    """Which sectors the rate trend favors (ties into the Sector Rotation)."""
    if not r or r.get("chg20_bp") is None:
        return None
    c = r["chg20_bp"]
    if c >= 15:
        return "Yields rising: favors financials (XLF) and value; a headwind for tech (XLK), real estate (XLRE), utilities (XLU)."
    if c <= -15:
        return "Yields falling: favors tech (XLK), real estate (XLRE), utilities (XLU) and long-duration growth."
    return "Yields steady: rates are not a major force on sectors right now."

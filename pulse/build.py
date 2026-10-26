"""F.O.C.U.S. Market Pulse data job (Jachbit 2026): Sector Rotation, Seasonality and Market Weather as static JSON.

No account, no keys: prices come from Yahoo Finance through yfinance (free, delayed, unofficial), and the math is the
F.O.C.U.S. Edge Scanner's own (rotation.py, market_weather.py, copied unchanged). The GitHub Action runs this about
hourly in market hours, then builds the site with the JSON inside it.

Writes into web/public/data/:
  meta.json                     when it ran, what loaded
  rotation_W.json / _D.json     the 11 sector ETFs vs SPY (RS-Ratio / RS-Momentum, 20-point tails)
  sectors/<ETF>_W.json / _D.json  the list's stocks of each sector vs that sector's ETF
  weather.json                  the Market Weather reading + 7 years of SPY closes for its chart (1M to 5Y)
  seasonality/index.json        the tickers with monthly history; seasonality/<SYM>.json their monthly closes
  universe.json                 every ticker followed: group, sector ETF, last close, day's change, found or not
Adding a ticker: one line in pulse/universe.txt (GitHub's web editor is enough); its sector ETF comes from
pulse/sectors.csv, or is looked up on Yahoo when the ticker is not there.
Run: python pulse/build.py   (from the project folder)
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import math
import sys
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from market_weather import compute as weather_compute  # noqa: E402
from rotation import SECTOR_ETFS, YAHOO_SECTOR_ETF, rotation  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "data"
ET = ZoneInfo("America/New_York")
INDEXES = {"SPY": "S&P 500", "QQQ": "Nasdaq 100", "IWM": "Russell 2000", "DIA": "Dow Jones"}
# Yahoo's names for the indexes and the rates / credit / dollar the weather reads (the scanner used Schwab's $VIX...)
YAHOO = {"$VIX": "^VIX", "$VIX3M": "^VIX3M", "$VIX9D": "^VIX9D", "$TNX": "^TNX", "$IRX": "^IRX", "HYG": "HYG", "IEF": "IEF", "UUP": "UUP"}
TAIL = 20


def universe() -> list[str]:
    return [ln.strip().upper() for ln in (HERE / "universe.txt").read_text(encoding="utf-8").splitlines()
            if ln.strip() and not ln.startswith("#")]


def sector_map() -> dict[str, str]:
    with open(HERE / "sectors.csv", encoding="utf-8") as f:
        return {r["symbol"].upper(): r["sector_etf"].upper() for r in csv.DictReader(f)}


def lookup_sectors(tickers: list[str]) -> dict[str, str]:
    """Sector ETF for tickers missing from sectors.csv (new names added to universe.txt): Yahoo's sector -> the SPDR ETF."""
    out: dict[str, str] = {}
    for t in tickers:
        try:
            sec = (yf.Ticker(t.replace(".", "-")).info or {}).get("sector")
        except Exception:
            sec = None
        if sec and YAHOO_SECTOR_ETF.get(sec):
            out[t] = YAHOO_SECTOR_ETF[sec]
        time.sleep(0.3)
    return out


def download(tickers: list[str], period: str, interval: str) -> dict[str, pd.DataFrame]:
    """yfinance in batches of 60, a retry for anything missing; {ticker: OHLC frame}."""
    out: dict[str, pd.DataFrame] = {}
    todo = list(dict.fromkeys(tickers))
    for attempt in range(2):
        missing = []
        for i in range(0, len(todo), 60):
            part = todo[i:i + 60]
            ysym = {t: t.replace(".", "-") for t in part}
            try:
                df = yf.download(list(ysym.values()), period=period, interval=interval, auto_adjust=True, progress=False,
                                 group_by="ticker", threads=True)
            except Exception as exc:
                print(f"  download failed ({exc}); retrying later", flush=True)
                missing += part
                continue
            for t, y in ysym.items():
                try:
                    d = (df[y] if isinstance(df.columns, pd.MultiIndex) else df)[["Open", "High", "Low", "Close"]].dropna()
                except Exception:
                    d = None
                if d is None or d.empty:
                    missing.append(t)
                else:
                    out[t] = d
            time.sleep(1)
        if not missing:
            break
        todo = missing
        time.sleep(5)
    return out


def closes(df: pd.DataFrame) -> list[tuple[dt.date, float]]:
    return [(t.date(), float(c)) for t, c in zip(df.index, df["Close"]) if c and not math.isnan(c)]


def write(name: str, data) -> None:
    p = OUT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False, default=str), encoding="utf-8")


def clean(o):
    """NaN / inf -> None, numpy / dates -> plain JSON."""
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, float):
        return None if math.isnan(o) or math.isinf(o) else o
    if hasattr(o, "item"):
        return clean(o.item())
    if isinstance(o, (dt.date, dt.datetime)):
        return o.isoformat()
    return o


def main() -> int:
    t0 = time.time()
    now = dt.datetime.now(ET)
    stocks, smap = universe(), sector_map()
    sectors = list(SECTOR_ETFS)
    print(f"F.O.C.U.S. Market Pulse: {len(stocks)} stocks, {len(sectors)} sectors", flush=True)
    daily = download(["SPY", *INDEXES, *sectors, *stocks, *YAHOO.values()], "3y", "1d")
    print(f"  daily: {len(daily)} tickers", flush=True)
    missing_sector = [s for s in stocks if s not in smap and s in daily]
    if missing_sector:
        found = lookup_sectors(missing_sector)
        smap.update(found)
        print(f"  sectors looked up for {len(missing_sector)} new tickers: {found}", flush=True)
    meta = {"built": now.isoformat(timespec="seconds"), "source": "Yahoo Finance via yfinance (delayed, unofficial)",
            "stocks": len(stocks), "daily_loaded": len(daily), "parts": {}}

    # ── Sector Rotation: the sector ETFs vs SPY; each sector's stocks vs its ETF ──
    try:
        cl = {s: closes(daily[s]) for s in ["SPY", *sectors] if s in daily}
        for tf in ("W", "D"):
            res = rotation(cl, "SPY", tf, TAIL)
            last = max((v["points"][-1][0] for v in res.values()), default=None)
            write(f"rotation_{tf}.json", clean({"tf": tf, "bench": "SPY", "asof": last, "n": [40, 20],
                                               "sectors": {k: dict(v, name=SECTOR_ETFS[k]) for k, v in res.items()},
                                               "error": None if res else "No price history for the sector ETFs"}))
            for etf in sectors:
                members = [s for s in stocks if smap.get(s) == etf and s in daily]
                mc = {s: closes(daily[s]) for s in [etf, *members] if s in daily}
                mres = rotation(mc, etf, tf, TAIL)
                mlast = max((v["points"][-1][0] for v in mres.values()), default=None)
                write(f"sectors/{etf}_{tf}.json", clean({"tf": tf, "bench": etf, "name": SECTOR_ETFS[etf], "asof": mlast,
                                                        "count": len(members), "members": {k: dict(v, name=k) for k, v in mres.items()},
                                                        "error": None if mres else f"No stock history for {etf}"}))
        meta["parts"]["rotation"] = "ok"
    except Exception as exc:
        meta["parts"]["rotation"] = f"failed: {exc}"
        print(f"  rotation failed: {exc}", flush=True)

    # ── Market Weather: the scanner's compute() on the list's stocks, SPY, VIX, rates & credit ──
    try:
        st = {s: [(t.date(), float(r["High"]), float(r["Low"]), float(r["Close"])) for t, r in daily[s].iterrows()]
              for s in stocks if s in daily}
        spy = closes(daily["SPY"])
        vx = {k: closes(daily[y]) for k, y in YAHOO.items() if y in daily}
        try:
            secq = {k: v["quadrant"] for k, v in rotation({s: closes(daily[s]) for s in ["SPY", *sectors] if s in daily},
                                                          "SPY", "W", 1).items()}
        except Exception:
            secq = {}
        res = weather_compute(st, spy, vx.get("$VIX") or [], vx.get("$VIX3M") or [], vx.get("$VIX9D") or [], secq,
                              rates={k: vx.get(k) or [] for k in ("$TNX", "$IRX", "HYG", "IEF", "UUP")})
        res["universe"] = len(st)
        res["computed_at"] = now.isoformat(timespec="seconds")
        # the chart reaches 5 years with a correct 200-day from its first day: 7 years of SPY (one extra ticker)
        long_spy = download(["SPY"], "7y", "1d").get("SPY")
        res["spy_bars"] = [[d.isoformat(), round(c, 2)] for d, c in (closes(long_spy) if long_spy is not None else spy)]
        write("weather.json", clean(res))
        meta["parts"]["weather"] = "ok"
    except Exception as exc:
        meta["parts"]["weather"] = f"failed: {exc}"
        print(f"  weather failed: {exc}", flush=True)

    # ── Seasonality: monthly closes (the browser computes the table for 5-25 years) ──
    try:
        seas = ["SPY", *[s for s in INDEXES if s != "SPY"], *sectors, *stocks]
        monthly = download(seas, "max", "1mo")
        cutoff = dt.date(now.year - 26, 1, 1)
        index = []
        for s in seas:
            if s not in monthly:
                continue
            pts = [[d.isoformat()[:7], round(c, 4)] for d, c in closes(monthly[s]) if d >= cutoff]
            if len(pts) < 24:
                continue
            write(f"seasonality/{s}.json", {"symbol": s, "monthly": pts})
            group = "Index" if s in INDEXES else "Sector" if s in SECTOR_ETFS else "Stock"
            index.append({"s": s, "g": group, "name": INDEXES.get(s) or SECTOR_ETFS.get(s) or ""})
        write("seasonality/index.json", {"symbols": index})
        meta["parts"]["seasonality"] = f"ok ({len(index)} tickers)"
    except Exception as exc:
        meta["parts"]["seasonality"] = f"failed: {exc}"
        print(f"  seasonality failed: {exc}", flush=True)

    # ── Universe: the list itself, for the Universe tab ──
    def last(sym: str) -> tuple:
        df = daily.get(sym)
        if df is None or len(df) < 2:
            return None, None
        c0, c1 = float(df["Close"].iloc[-2]), float(df["Close"].iloc[-1])
        return round(c1, 2), round((c1 / c0 - 1) * 100, 2) if c0 else None

    rows = []
    for s, g in [*[(s, "Index") for s in INDEXES], *[(s, "Sector") for s in sectors], *[(s, "Stock") for s in stocks]]:
        close, chg = last(s)
        etf = s if g == "Sector" else smap.get(s) if g == "Stock" else None
        rows.append({"s": s, "g": g, "etf": etf, "sector": SECTOR_ETFS.get(etf or "", ""), "name": INDEXES.get(s) or SECTOR_ETFS.get(s) or "",
                     "close": close, "chg": chg, "ok": s in daily})
    write("universe.json", clean({"rows": rows, "not_found": [r["s"] for r in rows if not r["ok"]],
                                  "counts": {"Index": len(INDEXES), "Sector": len(sectors), "Stock": len(stocks)}}))
    meta["seconds"] = round(time.time() - t0, 1)
    write("meta.json", meta)
    print(f"  done in {meta['seconds']} s: {meta['parts']}", flush=True)
    return 0 if any(str(v).startswith("ok") for v in meta["parts"].values()) else 1


if __name__ == "__main__":
    sys.exit(main())

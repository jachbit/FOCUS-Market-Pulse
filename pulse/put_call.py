"""F.O.C.U.S. Put / Call ratio for Market Weather (Jachbit 2026, 2026-11-24). Display only: not part of the Weather score.

From the Edge Scanner's scanner/put_call.py (parse_cboe, band and the 7-day fallback of cboe_latest copied with the same
math), CBOE numbers only: the scanner's live SPY / QQQ estimate needs a Schwab account and is left out here.

  CBOE    the official ratios (TOTAL, EQUITY, INDEX, SPX) from CBOE's free daily file
          cdn.cboe.com/data/us/options/market_statistics/daily/<YYYY-MM-DD>_daily_options (no login, no keys).
          Published once a day after the close, so during the session it is the PRIOR session's value.
          The same file carries the put and call volumes behind each ratio, shown as the math (puts / calls = ratio).

Reading (total ratio): above 1.0 = more puts than calls, fear (often contrarian bullish at extremes); 0.7-1.0 = normal;
under 0.7 = complacency (heavy call buying). The equity-only ratio runs lower, about 0.5-0.7 normal.
"""
from __future__ import annotations

import json
import time
import urllib.request
from datetime import date, datetime, timedelta
from typing import Callable, Optional
from zoneinfo import ZoneInfo

CBOE_URL = "https://cdn.cboe.com/data/us/options/market_statistics/daily/{day}_daily_options"
WANT = {"TOTAL PUT/CALL RATIO": "total", "EQUITY PUT/CALL RATIO": "equity", "INDEX PUT/CALL RATIO": "index",
        "SPX + SPXW + SPXO PUT/CALL RATIO": "spx"}
# the volume block behind each ratio in the same file
VOLUME_BLOCK = {"total": "SUM OF ALL PRODUCTS", "equity": "EQUITY OPTIONS", "index": "INDEX OPTIONS", "spx": "SPX + SPXW + SPXO"}
HISTORY_N = 20              # sessions in the trend line
_ET = ZoneInfo("America/New_York")


def parse_cboe(payload: dict) -> dict:
    """{total, equity, index, spx} as floats from CBOE's daily JSON (missing ones left out). Same as the scanner."""
    out: dict = {}
    for r in payload.get("ratios") or []:
        key = WANT.get(str(r.get("name") or "").strip().upper())
        try:
            if key:
                out[key] = round(float(r.get("value")), 2)
        except (TypeError, ValueError):
            pass
    return out


def parse_volumes(payload: dict) -> dict:
    """{total: {puts, calls}, ...}: the day's put and call volume behind each ratio (the math shown on the page)."""
    out: dict = {}
    for key, block in VOLUME_BLOCK.items():
        for r in payload.get(block) or []:
            if str(r.get("name") or "").strip().upper() == "VOLUME":
                try:
                    out[key] = {"puts": int(r.get("put")), "calls": int(r.get("call"))}
                except (TypeError, ValueError):
                    pass
    return out


def _get_json(url: str, timeout: float = 10.0) -> Optional[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})   # a generic client name (CBOE refuses none)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:                     # 403 / 404 = that day's file is not out (or no session that day)
        return None


def band(v: Optional[float], equity: bool = False) -> Optional[str]:
    """fear / normal / complacent for a total (or, equity=True, an equity-only) ratio. Same thresholds as the scanner."""
    if v is None:
        return None
    hi, lo = (0.7, 0.5) if equity else (1.0, 0.7)
    return "fear" if v > hi else "complacent" if v < lo else "normal"


def collect(now: Optional[datetime] = None, getter: Callable[[str], Optional[dict]] = _get_json,
            n: int = HISTORY_N, pause: float = 0.2) -> dict:
    """The newest CBOE daily file (as the scanner's cboe_latest: the last 7 days, weekends skipped) plus up to n sessions
    of the total ratio for the trend line (holidays / missing files skipped; any failure tolerated).
    {latest: {date, total, equity, index, spx, volumes, source} | None, latest_band, equity_band, history: [[date, total]], note}"""
    now = now or datetime.now(_ET)
    today = now.astimezone(_ET).date()
    days: list[tuple[str, dict]] = []
    d, misses = today, 0
    # walk back over weekdays until n sessions are in (about 6 weeks at most: holidays, a late file, a CBOE outage)
    while len(days) < n and (today - d).days <= n * 2 + 14:
        if d.weekday() < 5:
            raw = getter(CBOE_URL.format(day=d.isoformat()))
            vals = parse_cboe(raw) if raw else {}
            if vals.get("total") is not None:
                days.append((d.isoformat(), {**vals, "volumes": parse_volumes(raw)}))
            else:
                misses += 1
            if pause:
                time.sleep(pause)
        d -= timedelta(days=1)
    latest = None
    # the latest must be within the scanner's 7-day window, or the card would show a stale number as current
    if days and (today - date.fromisoformat(days[0][0])).days <= 7:
        latest = {"date": days[0][0], **days[0][1], "source": "CBOE daily market statistics"}
    out = {"latest": latest, "history": [[k, v["total"]] for k, v in reversed(days)],
           "note": "Display only: not part of the Weather score.", "misses": misses,
           "computed_at": now.isoformat(timespec="seconds")}
    if latest:
        out["latest_band"] = band(latest.get("total"))
        out["equity_band"] = band(latest.get("equity"), equity=True)
    return out


if __name__ == "__main__":
    print(json.dumps(collect(), indent=1))

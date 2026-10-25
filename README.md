# F.O.C.U.S.© Market Pulse

**Jachbit 2026** · Sector Rotation, Seasonality and Market Weather from the F.O.C.U.S. Edge Scanner, as a free static site.
No account, no API keys, no server: a GitHub Action fetches public market data, computes the readings with the scanner's
own math and publishes the site to GitHub Pages about hourly in market hours.

**Live:** https://jachbit.github.io/FOCUS-Market-Pulse/  (`#rotation`, `#seasonality`, `#weather` open a tab directly)

## The three tabs
- **Sector Rotation**: our own relative rotation graph of the 11 SPDR sector ETFs against SPY (RS-Ratio = 40-period
  z-score of relative strength, RS-Momentum = 20-period z-score of the ratio, both centred on 100), weekly or daily,
  tails of 1-20 points. Double-click a sector (or pick it in View) for its stocks against the sector ETF.
- **Seasonality**: each calendar month's average, median, % of years up, best and worst year over the last 5-25
  complete years, plus this year so far, for the indexes, the sector ETFs and the stock list (`pulse/universe.txt`).
- **Market Weather**: one 0-100 score (Clear / Mixed / Stormy) from SPY's trend, the breadth of the stock list, VIX in
  context (level, direction, 1-year percentile, VIX / VIX3M), rates & credit (10-year yield, curve, HYG / IEF, dollar)
  and the sector rotation; the SPY chart with the Bollinger Band (20, 2) and the 50 / 200-day; the score history.

## How it works
| Part | What |
|---|---|
| `pulse/build.py` | the data job: Yahoo Finance via yfinance (no key) -> `web/public/data/*.json` |
| `pulse/rotation.py`, `pulse/market_weather.py` | the Edge Scanner's math, unchanged |
| `pulse/universe.txt`, `pulse/sectors.csv` | the stock list (tickers only) and each stock's sector ETF |
| `web/` | the site (React + Vite, the Edge Scanner's look); Seasonality is computed in the browser |
| `.github/workflows/pulse.yml` | the schedule: fetch, compute, build, publish (weekdays about hourly 9:20 AM-5:20 PM ET) |

## Run it on your own computer
1. Python 3.11+ and Node 20+.
2. `pip install -r requirements.txt`, then `start.bat` (Windows): it runs the data job and opens the site at http://localhost:8793.

## Notes and limits
- Data is **delayed** (refreshed about hourly) and comes from Yahoo Finance through yfinance, a free but unofficial
  library: Yahoo can change things, and a run may occasionally fail (the site then keeps the last good build).
- Yahoo adjusts past prices for dividends, so long averages can differ slightly from a broker's chart.
- GitHub pauses scheduled workflows in a public repo after 60 days without commits: re-enable it in the Actions tab (or push any change).
- Rotation is our public approximation of a Relative Rotation Graph, not a copy of any vendor's chart.

For personal research only, not financial advice. © 2026 Jachbit. All rights reserved. · [linktr.ee/jachbit](https://linktr.ee/jachbit)

MIT License (see `LICENSE`): adapted from the edge-scanner dashboard by Tape to Edge.

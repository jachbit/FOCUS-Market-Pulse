// F.O.C.U.S. Market Pulse Help: how to read the three tabs, in plain words (from the Edge Scanner's Reading Guides).
import type { ReactNode } from 'react'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="card-head" style={{ fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>{children}</div>
    </div>
  )
}
const Sub = ({ children }: { children: ReactNode }) => <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--yellow)', textTransform: 'uppercase', margin: '8px 0 2px' }}>{children}</div>
const Ul = ({ items }: { items: ReactNode[] }) => <ul style={{ paddingLeft: 18 }}>{items.map((x, i) => <li key={i} style={{ marginBottom: 3 }}>{x}</li>)}</ul>

export function HelpTab() {
  return (
    <div style={{ maxWidth: 980 }}>
      <Section title="Getting around">
        <Ul items={[
          <>Three tabs: <b>Sector Rotation</b>, <b>Seasonality</b> and <b>Market Weather</b>. Each has its own link to share:
            <span className="mono"> #rotation</span>, <span className="mono">#seasonality</span>, <span className="mono">#weather</span>.</>,
          <>The data refreshes <b>about every hour on weekdays</b> (roughly 9:20 AM to 5:20 PM ET, one run after the close). The time of
            the last update is at the top right of the tabs. Prices are <b>delayed</b>: this is a research view, not a trading screen.</>,
          <>Hover over a dot, a bar or a number to see its details.</>,
        ]} />
      </Section>

      <Section title="◴ Sector Rotation: where is the money flowing?">
        <p>The 11 SPDR sector ETFs (XLK Technology, XLV Health Care, XLE Energy...) against the S&amp;P 500 (SPY). Each sector gets two scores,
          both centred on <b>100</b>:</p>
        <Sub>The two numbers</Sub>
        <Ul items={[
          <><b>RS-Ratio</b> (across, RS = Relative Strength): is the sector beating SPY, and how strongly? It compares the sector's strength
            against SPY with its own average of the last 40 weeks (or days). 100 = average; each point is half a standard deviation:
            102 = clearly outperforming, 104+ = unusually strong, 98 / 96 = clearly / unusually underperforming.</>,
          <><b>RS-Momentum</b> (up): is that lead growing or fading? Above 100 = the ratio is rising; below 100 = it is falling.</>,
        ]} />
        <Sub>The four quadrants</Sub>
        <Ul items={[
          <><span style={{ color: '#22c55e', fontWeight: 900 }}>Leading</span> (top right): beating SPY and still gaining.</>,
          <><span style={{ color: '#eab308', fontWeight: 900 }}>Weakening</span> (bottom right): still ahead of SPY but losing ground.</>,
          <><span style={{ color: '#ef4444', fontWeight: 900 }}>Lagging</span> (bottom left): behind SPY and still losing.</>,
          <><span style={{ color: '#3b82f6', fontWeight: 900 }}>Improving</span> (top left): behind SPY but catching up.</>,
          <>Sectors usually rotate <b>clockwise</b>: Improving → Leading → Weakening → Lagging → Improving.</>,
        ]} />
        <Sub>Using it</Sub>
        <Ul items={[
          <><b>Tail</b>: the last few weeks (or days) of each sector's path; the big dot is now. The tail's direction shows where it is heading.</>,
          <><b>Weekly</b> for the bigger picture (swing trades), <b>Daily</b> for the short term (it moves faster and noisier).</>,
          <><b>Stocks in a sector</b>: double-click a sector dot (or pick it in View) to see that sector's stocks against the sector ETF,
            colored by quadrant. Click a sector chip below the map to hide or show it.</>,
          <>A long trade has the wind at its back when both the sector and the stock are <b>Leading or Improving</b>; a short when both are
            <b> Weakening or Lagging</b>.</>,
          <>Our own public approximation of a Relative Rotation Graph: the quadrants usually agree with the well-known charts, the exact values do not.</>,
        ]} />
      </Section>

      <Section title="▦ Seasonality: is this month usually kind to it?">
        <p>How a ticker has done in each calendar month over the last 5 to 25 complete years (pick it in <b>Years</b>; 15 is a good default for
          indexes and sectors, 10 often fits a single stock better).</p>
        <Sub>The chart and the table</Sub>
        <Ul items={[
          <><b>Bars</b>: the average return of that month (green up, red down).</>,
          <><b>% on top</b>: the share of years the month was up (green 60%+, red 45% or less).</>,
          <><b>White diamonds</b>: this year's months so far (the current month is month-to-date and moves until it closes). A month far
            off the scale is pinned to the edge with an arrow and its value.</>,
          <><b>Outlined month</b>: the current month. The <b>table</b> adds the median, the best and the worst year.</>,
        ]} />
        <Sub>Reading tips</Sub>
        <Ul items={[
          <><b>Read the median with the average</b>: one huge year can drag the average; when they disagree, the median is the typical year.</>,
          <><b>% up says how reliable the month is</b>; <b>check the worst year</b> before trusting a strong month.</>,
          <><b>A tailwind or headwind, not a signal</b>: use it with Sector Rotation (a Leading sector in a strong month = confluence) and your own analysis.</>,
          <>The list covers the indexes (SPY, QQQ, IWM, DIA), the 11 sector ETFs and about 250 large stocks: type a ticker or pick one.</>,
        ]} />
      </Section>

      <Section title="☀ Market Weather: is the market wind at my back?">
        <p>One score from 0 to 100, from the S&amp;P 500's trend, how many stocks are joining in, the VIX (fear), rates &amp; credit and the sector rotation.</p>
        <Sub>The verdict</Sub>
        <Ul items={[
          <><span style={{ color: '#22c55e', fontWeight: 900 }}>☀ Clear 70-100</span>: risk-on, normal size, long bias.</>,
          <><span style={{ color: '#fbbf24', fontWeight: 900 }}>⛅ Mixed 40-69</span>: selective, smaller size, only the best ideas.</>,
          <><span style={{ color: '#ef4444', fontWeight: 900 }}>⛈ Stormy 0-39</span>: defensive, a quarter size or cash. In a downtrend, avoiding the bad weeks matters more than shorting them.</>,
          <>Read the <b>warnings</b> under it (a narrow market, weakening credit, an inverted VIX curve) and the <b>options</b> hint.</>,
        ]} />
        <Sub>The parts</Sub>
        <Ul items={[
          <><b>VIX in context</b>: under 15 Calm, 15-20 Cautious, 20-30 Fear, 30+ Panic. Its <b>direction</b> matters as much as its level (falling = fear easing);
            the <b>1-year percentile</b> is fairer than a fixed band; <b>VIX / VIX3M</b> above 1 means stress right now.</>,
          <><b>Breadth</b>: the share of the stock list above its 20 / 50 / 200-day averages (green 60%+, red under 40%), advancers vs decliners,
            new 52-week highs vs lows. The index near its high with weak breadth = a narrow market led by a few giants.</>,
          <><b>Rates &amp; credit</b>: the 10-year yield and how fast it moved (+25 bp in 20 sessions is a classic headwind for growth stocks),
            the 10-year minus 3-month curve (inverted = a recession warning), high-yield vs Treasury bonds (falling = big money turning
            cautious, often early) and the dollar.</>,
          <><b>SPY trend &amp; the SPY chart</b>: above or below its 20 / 50 / 200-day averages; the chart shows the Bollinger Band (its middle line
            is the 20-day average) and the 50 / 200-day. Pick 1M to 1Y; 6M-1Y shows how price sits against the 200-day.</>,
          <><b>How the score is built</b>: each part's score and weight. <b>Score history</b>: the last 60 sessions.</>,
        ]} />
      </Section>

      <Section title="The data and its limits">
        <Ul items={[
          <>Prices come from <b>Yahoo Finance</b> through the free yfinance library: delayed, and occasionally a refresh fails (the site then
            keeps the last good update). Yahoo adjusts past prices for dividends, so long averages can differ slightly from a broker's chart.</>,
          <>The calculations are the F.O.C.U.S. Edge Scanner's own (the same Rotation, Seasonality and Weather math).</>,
          <><b>For personal research only, not financial advice.</b> Trading is risky; past patterns do not guarantee future results.</>,
        ]} />
      </Section>
    </div>
  )
}

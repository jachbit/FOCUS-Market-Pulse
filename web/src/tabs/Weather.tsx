// F.O.C.U.S. Market Weather (from the Edge Scanner window, pulse/market_weather.py): the verdict (score, weather, size,
// options hint, warnings), VIX in context, breadth of the stock list, rates & credit, SPY trend and sectors with the SPY
// chart, how each part scored, and the score over the last 60 sessions.
import { useState, type ReactNode } from 'react'
import { etTime, useJson, type WeatherPayload } from '../lib/data'
import { SPY_RANGES, SpyChart, series, type SpyRange } from './SpyChart'
import { downloadReport, type Section } from '../lib/pdf'

const WEATHER_COLOR: Record<string, string> = { Clear: '#22c55e', Mixed: '#fbbf24', Stormy: '#ef4444' }
const BAND_COLOR: Record<string, string> = { Calm: '#22c55e', Cautious: '#fbbf24', Fear: '#fb923c', Panic: '#ef4444' }
// plain words for a general audience (the scanner's own text speaks of its alerts and setups)
const SIZE_TEXT: Record<string, string> = {
  Clear: 'Full size; long bias', Mixed: 'Half size; be selective, only the best ideas', Stormy: 'Quarter size or cash; defense first',
}
const row = (k: string, v: ReactNode, title?: string) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '2px 0' }} title={title}>
    <span>{k}</span><span className="mono">{v}</span>
  </div>
)
const pctColor = (v: number | null | undefined) => (v == null ? 'var(--text)' : v >= 60 ? '#22c55e' : v >= 40 ? '#fbbf24' : '#ef4444')

function Bar({ v }: { v: number | null | undefined }) {
  return (
    <div style={{ height: 8, background: 'var(--border-soft)', borderRadius: 4, overflow: 'hidden', margin: '1px 0 5px' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%`, height: '100%', background: pctColor(v) }} />
    </div>
  )
}

function History({ pts }: { pts: [string, number][] }) {
  if (pts.length < 2) return null
  const W = 900, H = 150, P = { l: 34, r: 8, t: 8, b: 20 }
  const x = (i: number) => P.l + (i / (pts.length - 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / 100) * (H - P.t - P.b)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <rect x={P.l} y={y(100)} width={W - P.l - P.r} height={y(70) - y(100)} fill="rgba(34,197,94,.10)" />
      <rect x={P.l} y={y(70)} width={W - P.l - P.r} height={y(40) - y(70)} fill="rgba(251,191,36,.10)" />
      <rect x={P.l} y={y(40)} width={W - P.l - P.r} height={y(0) - y(40)} fill="rgba(239,68,68,.10)" />
      {[0, 40, 70, 100].map(v => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border-soft)" strokeWidth={0.6} />
          <text x={P.l - 5} y={y(v) + 4} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--text)">{v}</text>
        </g>
      ))}
      <polyline points={pts.map(([, v], i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#93c5fd" strokeWidth={2.2} />
      {pts.map(([d, v], i) => (
        <circle key={d} cx={x(i)} cy={y(v)} r={i === pts.length - 1 ? 5 : 2.5} fill={v >= 70 ? '#22c55e' : v >= 40 ? '#fbbf24' : '#ef4444'}><title>{`${d}: ${v}`}</title></circle>
      ))}
      <text x={P.l} y={H - 4} fontSize={12} fontWeight={700} fill="var(--text)">{pts[0][0]}</text>
      <text x={W - P.r} y={H - 4} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--text)">{pts[pts.length - 1][0]}</text>
    </svg>
  )
}

/** Every grade with its range, today's one outlined in its color. */
function GradeStrip({ grades, active, column }: { grades: { name: string; range: string; note?: string; color: string }[]; active: string | null | undefined; column?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: column ? 'column' : 'row', alignItems: column ? 'flex-start' : undefined, flexWrap: 'wrap', gap: column ? 3 : 4, marginTop: 6 }}>
      {grades.map(g => {
        const on = g.name === active
        return (
          <span key={g.name} style={{ fontSize: 12, fontWeight: on ? 900 : 700, color: on ? g.color : '#fff', whiteSpace: 'nowrap', padding: '1px 7px', borderRadius: 10,
            border: `${on ? 2 : 1}px solid ${on ? g.color : 'var(--border)'}` }}>
            {g.name} {g.range}{g.note ? ` · ${g.note}` : ''}
          </span>
        )
      })}
    </div>
  )
}
const SCORE_GRADES = [
  { name: '☀ Clear', key: 'Clear', range: '70-100', note: 'full size, long bias', color: '#22c55e' },
  { name: '⛅ Mixed', key: 'Mixed', range: '40-69', note: 'half size, selective', color: '#fbbf24' },
  { name: '⛈ Stormy', key: 'Stormy', range: '0-39', note: '¼ size or cash, defense', color: '#ef4444' },
]
const VIX_GRADES = [
  { name: 'Calm', range: 'under 15', color: '#22c55e' }, { name: 'Cautious', range: '15-20', color: '#fbbf24' },
  { name: 'Fear', range: '20-30', color: '#fb923c' }, { name: 'Panic', range: '30+', color: '#ef4444' },
]

/** F.O.C.U.S. Market Weather PDF: the page on one sheet (verdict, VIX, breadth, rates & credit, SPY trend & sectors, the SPY
 *  chart at the chosen range, how the score is built, the score history), like the Edge Scanner's Market Weather PDF. */
async function weatherPdf(d: WeatherPayload, range: SpyRange) {
  const sign = (v: number) => (v > 0 ? '+' : '')
  const v = d.vix, b = d.breadth, s = d.spy, rt = d.rates
  const out: Section[] = []
  const verdict: [string, string][] = [['Score', `${Math.round(d.score ?? 0)} ${d.weather?.name ?? ''}`],
    ['Size', SIZE_TEXT[d.weather?.name ?? ''] ?? d.weather?.size ?? '—'], ['Options', d.hint ?? '—'],
    ['As of', `${d.asof ?? '—'}${d.computed_at ? `, updated ${etTime(d.computed_at)}` : ''}`]]
  ;(d.warnings ?? []).forEach((w, i) => verdict.push([`Warning ${i + 1}`, w]))
  out.push({ kind: 'kv', title: 'The verdict (70-100 Clear, 40-69 Mixed, under 40 Stormy)', rows: verdict })
  if (v) {
    const rows: [string, string][] = [['VIX', `${v.vix} · ${v.band}`], ['vs 10-day average', `${v.dir} (${v.avg10})`], ['1-year percentile', `${v.pctile}%`]]
    if (v.ratio != null) rows.push(['VIX / VIX3M', `${v.ratio} · ${v.structure ?? ''}`])
    if (v.vix9d != null) rows.push(['VIX9D', String(v.vix9d)])
    out.push({ kind: 'kv', title: 'VIX in context (under 15 Calm · 15-20 Cautious · 20-30 Fear · 30+ Panic)', rows, perRow: 3 })
  }
  if (b) out.push({ kind: 'kv', title: `Breadth (${b.n} stocks)`, perRow: 3, rows: [
    ['Above 20-day', `${b.above20}%`], ['Above 50-day', `${b.above50}%`], ['Above 200-day', `${b.above200}%`],
    ['Advancers / decliners', `${b.adv} / ${b.dec} (${b.advancers}%)`], ['New 52-wk highs / lows', `${b.highs} / ${b.lows}`]] })
  if (rt) {
    const rows: [string, string][] = []
    if (rt.y10 != null) rows.push(['10-year yield', `${rt.y10.toFixed(2)}%`])
    if (rt.chg20_bp != null) rows.push(['10-year, 20-day change', `${sign(rt.chg20_bp)}${rt.chg20_bp} bp`])
    if (rt.curve != null) rows.push(['Curve 10Y - 3M', `${sign(rt.curve)}${rt.curve.toFixed(2)}% ${rt.curve < 0 ? '(inverted)' : '(normal)'}`])
    if (rt.credit_dev != null) rows.push(['Credit HYG / IEF vs 20-day', `${sign(rt.credit_dev)}${rt.credit_dev}%`])
    if (rt.dollar_chg != null) rows.push(['Dollar (UUP), 20-day', `${sign(rt.dollar_chg)}${rt.dollar_chg}%`])
    if (d.rates_hint) rows.push(['Hint', d.rates_hint])
    if (rows.length) out.push({ kind: 'kv', title: 'Rates & credit', rows })
  }
  if (s || d.sectors) {
    const above = (ma: number | null) => (ma == null || !s ? '—' : `${s.close > ma ? 'above' : 'below'} (${ma})`)
    const rows: [string, string][] = []
    if (s) {
      rows.push(['SPY', String(s.close)], ['vs 20-day', above(s.sma20)], ['vs 50-day', above(s.sma50)], ['vs 200-day', above(s.sma200)])
      if (s.hi252 != null) rows.push(['From 52-wk high', `${(((s.close / s.hi252) - 1) * 100).toFixed(1)}%`])
    }
    if (d.sectors) rows.push(['Sectors Leading / Improving', `${d.sectors.good} of ${d.sectors.total}`],
      ['Leading', d.sectors.leading.join(', ') || '—'], ['Improving', d.sectors.improving.join(', ') || '—'])
    out.push({ kind: 'kv', title: 'SPY trend & sectors', rows, perRow: 3 })
  }
  if (d.spy_bars && d.spy_bars.length > 1) {
    const view = series(d.spy_bars, SPY_RANGES[range])
    const col = (k: 'c' | 'up' | 'lo' | 'mid' | 's50' | 's200') => view.map(p => p[k])
    out.push({ kind: 'lines', title: `SPY · ${range} daily · Bollinger Band (20, 2) · 50 / 200-day`, x: view.map(p => p.d), height: 190, series: [
      { label: 'BB upper', values: col('up'), color: 'blue', dash: true, width: 0.7 },
      { label: 'BB mid = 20-day', values: col('mid'), color: 'blue', width: 0.7 },
      { label: 'BB lower', values: col('lo'), color: 'blue', dash: true, width: 0.7 },
      { label: '50-day', values: col('s50'), color: 'orange', width: 1.1 },
      { label: '200-day', values: col('s200'), color: 'green', width: 1.3 },
      { label: 'SPY', values: col('c'), color: 'navy', width: view.length > 600 ? 1.1 : 1.6 }] })
  }
  if (d.components?.length) out.push({ kind: 'note', title: 'How the score is built (each part 0-100, its weight)',
    text: d.components.map(c => `${c.label} ${c.score == null ? '—' : Math.round(c.score)} (weight ${c.weight})`).join('  ·  ') })
  if (d.history && d.history.length > 1) out.push({ kind: 'lines', title: `Score, last ${d.history.length} sessions (70+ Clear, under 40 Stormy)`,
    x: d.history.map(h => h[0]), height: 110, yMin: 0, yMax: 100, series: [
      { label: 'Clear (70)', values: d.history.map(() => 70), color: 'green', dash: true, width: 0.6 },
      { label: 'Stormy (40)', values: d.history.map(() => 40), color: 'red', dash: true, width: 0.6 },
      { label: 'Market Weather score', values: d.history.map(h => h[1]), color: 'navy', width: 1.5 }] })
  await downloadReport('F.O.C.U.S.© — Market Pulse — Market Weather',
    `Market Weather ${Math.round(d.score ?? 0)} ${d.weather?.name ?? ''} · as of ${d.asof} · SPY ${range} daily · ${d.universe} stocks`, 'Market_Weather', out)
}

export function WeatherTab() {
  const { data: d, error } = useJson<WeatherPayload>('weather.json')
  const [range, setRange] = useState<SpyRange>('1Y')
  const [busy, setBusy] = useState(false)
  if (!d) return error ? <div className="empty">Market Weather unavailable: {error}</div> : <div className="empty">Reading the market weather…</div>
  if (d.score == null || !d.weather?.name) return <div className="empty">No market data in this build. {d.error}</div>
  const wc = WEATHER_COLOR[d.weather.name]
  const v = d.vix, b = d.breadth, s = d.spy
  const tick = (ok: boolean | null) => (ok == null ? '—' : ok ? <span style={{ color: '#22c55e' }}>✓ above</span> : <span style={{ color: '#ef4444' }}>✗ below</span>)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="card" style={{ borderColor: wc, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>{d.weather.icon}</div>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900, color: wc, lineHeight: 1 }}>{Math.round(d.score)} <span style={{ fontSize: 20 }}>{d.weather.name}</span></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{SIZE_TEXT[d.weather.name] ?? d.weather.size}</div>
          <GradeStrip column grades={SCORE_GRADES} active={SCORE_GRADES.find(g => g.key === d.weather?.name)?.name} />
        </div>
        <div style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          <div><span style={{ color: 'var(--orange)' }}>Options:</span> {d.hint}</div>
          {(d.warnings ?? []).map(w => <div key={w} style={{ color: '#fbbf24', marginTop: 4 }}>⚠ {w}</div>)}
        </div>
      </div>
      <div className="note" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ flex: 1 }}>As of {d.asof}{d.computed_at ? <> · <b style={{ color: '#fff' }}>updated {etTime(d.computed_at)}</b> (about hourly in market hours)</> : null} · {d.universe} stocks in the list · 70-100 Clear, 40-70 Mixed, under 40 Stormy</span>
        <button className="btn" disabled={busy} title={`Download this page as a PDF (SPY chart at ${range})`}
          onClick={async () => { setBusy(true); try { await weatherPdf(d, range) } finally { setBusy(false) } }}>{busy ? 'Making PDF…' : '⤓ PDF'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 8 }}>
        {v && (
          <div className="card">
            <div className="card-head">VIX in context</div>
            {row('VIX', <span style={{ color: BAND_COLOR[v.band] }}>{v.vix} · {v.band}</span>, 'Under 15 Calm · 15-20 Cautious · 20-30 Fear · over 30 Panic')}
            <div style={{ marginBottom: 6 }}><GradeStrip grades={VIX_GRADES} active={v.band} /></div>
            {row('vs 10-day average', <span style={{ color: v.dir === 'falling' ? '#22c55e' : v.dir === 'rising' ? '#ef4444' : 'var(--text)' }}>
              {v.dir === 'falling' ? '▼ falling' : v.dir === 'rising' ? '▲ rising' : '► flat'} ({v.avg10})</span>,
              'Falling = fear easing (bullish); rising = fear building, even from a low level')}
            {row('1-year percentile', `${v.pctile}%`, `VIX is higher than ${v.pctile}% of the last year's closes`)}
            {v.ratio != null && row('VIX / VIX3M', <span style={{ color: v.ratio > 1 ? '#ef4444' : v.ratio > 0.95 ? '#fbbf24' : '#22c55e' }}>{v.ratio} · {v.structure}</span>,
              'Below 1 = contango (normal); above 1 = backwardation: stress right now, often near panic lows')}
            {v.vix9d != null && row('VIX9D', v.vix9d, '9-day VIX: the nearest-term fear')}
          </div>
        )}
        {b && (
          <div className="card">
            <div className="card-head">Breadth ({b.n} stocks{b.asof !== d.asof ? `, ${b.asof}` : ''})</div>
            {row('Above 20-day', <span style={{ color: pctColor(b.above20) }}>{b.above20}%</span>)}<Bar v={b.above20} />
            {row('Above 50-day', <span style={{ color: pctColor(b.above50) }}>{b.above50}%</span>)}<Bar v={b.above50} />
            {row('Above 200-day', <span style={{ color: pctColor(b.above200) }}>{b.above200}%</span>)}<Bar v={b.above200} />
            {row('Advancers / decliners', <span style={{ color: pctColor(b.advancers) }}>{b.adv} / {b.dec} ({b.advancers}%)</span>)}
            {row('New 52-wk highs / lows', <span style={{ color: b.highs >= b.lows ? '#22c55e' : '#ef4444' }}>{b.highs} / {b.lows}</span>)}
          </div>
        )}
        {d.rates && (
          <div className="card">
            <div className="card-head">Rates & credit</div>
            {d.rates.y10 != null && row('10-year yield', `${d.rates.y10.toFixed(2)}%`, 'The price of money: a fast rise is a headwind for growth / tech, real estate and utilities')}
            {d.rates.chg20_bp != null && row('10-year, 20-day change',
              <span style={{ color: d.rates.chg20_bp >= 25 ? '#ef4444' : d.rates.chg20_bp >= 10 ? '#fbbf24' : d.rates.chg20_bp <= -10 ? '#22c55e' : 'var(--text)' }}>
                {d.rates.chg20_bp > 0 ? '▲ +' : d.rates.chg20_bp < 0 ? '▼ ' : ''}{d.rates.chg20_bp} bp</span>,
              'Speed matters more than level: +25 bp or more in 20 sessions is a classic stock headwind')}
            {d.rates.curve != null && row('Curve 10Y - 3M', <span style={{ color: d.rates.curve < 0 ? '#ef4444' : '#22c55e' }}>
              {d.rates.curve > 0 ? '+' : ''}{d.rates.curve.toFixed(2)}% {d.rates.curve < 0 ? '(inverted)' : '(normal)'}</span>, 'Inverted = historically a recession warning')}
            {d.rates.credit_dev != null && row('Credit HYG / IEF vs 20-day', <span style={{ color: d.rates.credit_dev <= -0.5 ? '#ef4444' : d.rates.credit_dev >= 0 ? '#22c55e' : '#fbbf24' }}>
              {d.rates.credit_dev > 0 ? '+' : ''}{d.rates.credit_dev}%</span>, 'High-yield bonds vs Treasuries: falling = big money turning risk-off, often before stocks')}
            {d.rates.dollar_chg != null && row('Dollar (UUP), 20-day', <span style={{ color: d.rates.dollar_chg >= 2 ? '#ef4444' : d.rates.dollar_chg <= -1 ? '#22c55e' : 'var(--text)' }}>
              {d.rates.dollar_chg > 0 ? '+' : ''}{d.rates.dollar_chg}%</span>, 'A sharply rising dollar tightens financial conditions')}
            {d.rates_hint && <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginTop: 4 }}>{d.rates_hint}</div>}
          </div>
        )}
        <div className="card">
          <div className="card-head">SPY trend & sectors</div>
          {s && <>
            {row('SPY', s.close)}
            {row('vs 20-day', tick(s.sma20 == null ? null : s.close > s.sma20), s.sma20 != null ? `20-day ${s.sma20}` : undefined)}
            {row('vs 50-day', tick(s.sma50 == null ? null : s.close > s.sma50), s.sma50 != null ? `50-day ${s.sma50}` : undefined)}
            {row('vs 200-day', tick(s.sma200 == null ? null : s.close > s.sma200), s.sma200 != null ? `200-day ${s.sma200}` : undefined)}
            {s.hi252 != null && row('From 52-wk high', `${(((s.close / s.hi252) - 1) * 100).toFixed(1)}%`, `52-week high close ${s.hi252}`)}
          </>}
          {d.sectors && <>
            {row('Sectors Leading / Improving', <span style={{ color: pctColor(100 * d.sectors.good / d.sectors.total) }}>{d.sectors.good} of {d.sectors.total}</span>, 'From the Sector Rotation (weekly)')}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              <span style={{ color: '#22c55e' }}>Leading:</span> {d.sectors.leading.join(', ') || '—'} · <span style={{ color: '#3b82f6' }}>Improving:</span> {d.sectors.improving.join(', ') || '—'}
            </div>
          </>}
        </div>
        {d.spy_bars && d.spy_bars.length > 1 && (
          <div className="card" style={{ gridColumn: '1 / -1', minWidth: 0 }}>
            <div className="card-head">SPY daily · BB (20, 2) · 50 / 200-day</div>
            <SpyChart bars={d.spy_bars} range={range} onRange={setRange} />
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-head">How the score is built</div>
        {(d.components ?? []).map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--text)', padding: '1px 0', flexWrap: 'wrap' }}>
            <span style={{ width: 280, maxWidth: '100%' }}>{c.label}</span>
            <span className="mono" style={{ width: 70 }}>weight {c.weight}</span>
            <div style={{ flex: 1, minWidth: 120 }}><Bar v={c.score} /></div>
            <span className="mono" style={{ width: 44, textAlign: 'right', color: pctColor(c.score) }}>{c.score == null ? '—' : Math.round(c.score)}</span>
          </div>
        ))}
      </div>
      {d.history && d.history.length > 1 && (
        <div className="card">
          <div className="card-head">Score, last {d.history.length} sessions (sector part: today only)</div>
          <History pts={d.history} />
        </div>
      )}
    </div>
  )
}

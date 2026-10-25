// F.O.C.U.S. Seasonality (from the Edge Scanner window): each calendar month's record for a ticker. Bars = average
// monthly return over the last N complete years (green up, red down) with the % of years the month was up on top;
// white diamonds = this year's months so far; the current month is outlined. Table below: average, median, % up, best
// and worst year. Scale: sized to the average bars (this year's diamonds up to 3x the biggest average), so one extreme
// month cannot flatten the bars; a diamond beyond the scale is pinned to the edge with an arrow and its value.
import { useMemo, useState } from 'react'
import { useJson, type SeasonIndex, type SeasonMonthly } from '../lib/data'
import { seasonality } from '../lib/seasonality'

const W = 1000, H = 330, PAD = { l: 52, r: 16, t: 28, b: 34 }
const pct = (v?: number) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`)

export function SeasonalityTab() {
  const [symbol, setSymbol] = useState('SPY')
  const [text, setText] = useState('SPY')
  const [years, setYears] = useState(15)
  const idx = useJson<SeasonIndex>('seasonality/index.json')
  const known = useMemo(() => new Set((idx.data?.symbols ?? []).map(s => s.s)), [idx.data])
  const raw = useJson<SeasonMonthly>(known.has(symbol) ? `seasonality/${symbol}.json` : null)
  const d = useMemo(() => (raw.data ? seasonality(raw.data.monthly, years) : null), [raw.data, years])
  const commit = (v: string) => {
    const s = v.trim().toUpperCase()
    if (s) { setSymbol(s); setText(s) }
  }
  const year = new Date().getFullYear()

  const months = d?.months ?? []
  const base = Math.max(2, ...months.map(m => Math.abs(m.avg ?? 0)))
  const yearMax = Math.max(0, ...months.map(m => Math.abs(d?.this_year[m.name] ?? 0)))
  const top = Math.max(base * 1.4, Math.min(yearMax, base * 3)) * 1.1
  const y = (v: number) => PAD.t + (1 - (Math.max(-top, Math.min(top, v)) + top) / (2 * top)) * (H - PAD.t - PAD.b)
  const bw = (W - PAD.l - PAD.r) / 12
  const step = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find(st => top / st <= 4) ?? 100
  const grid: number[] = []
  for (let v = -Math.floor(top / step) * step; v <= top + 1e-9; v += step) grid.push(Math.round(v * 100) / 100)
  const groups = ['Index', 'Sector', 'Stock'] as const

  return (
    <div>
      <div className="toolbar">
        <input className="input" list="season-syms" value={text} style={{ width: 120, textTransform: 'uppercase' }}
          onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commit(text) }} onBlur={() => commit(text)}
          placeholder="Ticker" title="Type or pick a ticker, then Enter" />
        <datalist id="season-syms">
          {groups.flatMap(g => (idx.data?.symbols ?? []).filter(s => s.g === g).map(s => <option key={s.s} value={s.s}>{s.name || g}</option>))}
        </datalist>
        <select className="input" value="" onChange={e => { if (e.target.value) commit(e.target.value) }} style={{ width: 170 }} title="Indexes and sector ETFs">
          <option value="">Indexes & sectors…</option>
          {(idx.data?.symbols ?? []).filter(s => s.g !== 'Stock').map(s => <option key={s.s} value={s.s}>{s.s} · {s.name}</option>)}
        </select>
        <span className="note">Years</span>
        <select className="input" value={years} onChange={e => setYears(Number(e.target.value))} style={{ width: 64 }}>
          {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <span className="note">{d?.from ? `${symbol} · ${d.from}-${d.to}` : ''}{idx.data ? ` · ${idx.data.symbols.length} tickers` : ''}</span>
      </div>
      {idx.data && !known.has(symbol) && <div className="warn">{symbol} is not in this site's list (indexes, sector ETFs and the stock list). Pick one from the list.</div>}
      {(idx.error || raw.error) && <div className="warn">{idx.error ?? raw.error}</div>}
      {!d ? (known.has(symbol) && !raw.error && <div className="empty">Loading {symbol} seasonality…</div>) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', background: 'var(--panel)', borderRadius: 8 }}>
            {grid.map(v => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--border-soft)" strokeWidth={v === 0 ? 1.5 : 0.5} />
                <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize={13} fontWeight={700} fill="var(--text)">{v > 0 ? '+' : ''}{v}%</text>
              </g>
            ))}
            {months.map((m, i) => {
              const cx = PAD.l + bw * i + bw / 2
              const avg = m.avg ?? 0
              const cur = m.m === d.current_month
              const ty = d.this_year[m.name]
              const title = `${m.name}: average ${pct(m.avg)}, median ${pct(m.median)}, up ${m.pct_up ?? '—'}% of ${m.n} years`
                + (m.best ? `\nBest ${m.best[0]} ${pct(m.best[1])} · worst ${m.worst?.[0]} ${pct(m.worst?.[1])}` : '')
                + (ty != null ? `\n${year}: ${pct(ty)}${cur ? ' (month to date)' : ''}` : '')
              return (
                <g key={m.m}>
                  <title>{title}</title>
                  {cur && <rect x={cx - bw / 2 + 2} y={PAD.t - 22} width={bw - 4} height={H - PAD.t - PAD.b + 22} fill="none" stroke="#fbbf24" strokeWidth={2} rx={4} />}
                  <rect x={cx - bw * 0.32} width={bw * 0.64} y={Math.min(y(avg), y(0))} height={Math.max(1, Math.abs(y(avg) - y(0)))}
                    fill={avg >= 0 ? '#22c55e' : '#ef4444'} opacity={0.85} />
                  <text x={cx} y={PAD.t - 8} textAnchor="middle" fontSize={13} fontWeight={800}
                    fill={(m.pct_up ?? 0) >= 60 ? '#22c55e' : (m.pct_up ?? 100) <= 45 ? '#ef4444' : 'var(--text)'}>{m.pct_up ?? '—'}%</text>
                  {ty != null && Math.abs(ty) <= top && <path d={`M ${cx} ${y(ty) - 7} L ${cx + 7} ${y(ty)} L ${cx} ${y(ty) + 7} L ${cx - 7} ${y(ty)} Z`} fill="#fff" stroke="#000" strokeWidth={1} />}
                  {ty != null && Math.abs(ty) > top && (
                    <g>
                      <path d={ty > 0 ? `M ${cx} ${PAD.t + 2} L ${cx + 7} ${PAD.t + 12} L ${cx - 7} ${PAD.t + 12} Z`
                                      : `M ${cx} ${H - PAD.b - 2} L ${cx + 7} ${H - PAD.b - 12} L ${cx - 7} ${H - PAD.b - 12} Z`}
                        fill="#fff" stroke="#000" strokeWidth={1} />
                      <text x={cx} y={ty > 0 ? PAD.t + 26 : H - PAD.b - 16} textAnchor="middle" fontSize={12} fontWeight={800}
                        fill={ty > 0 ? '#22c55e' : '#ef4444'}>{ty > 0 ? '+' : ''}{ty.toFixed(1)}%</text>
                    </g>
                  )}
                  <text x={cx} y={H - PAD.b + 20} textAnchor="middle" fontSize={14} fontWeight={800} fill={cur ? '#fbbf24' : 'var(--text)'}>{m.name}</text>
                </g>
              )
            })}
          </svg>
          <div className="note" style={{ padding: '6px 0' }}>
            Bars: average return · top: % of years up (green 60%+, red 45% or less) · ◆ {year} so far · outlined: this month
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
              <thead>
                <tr>{['Month', 'Avg', 'Median', '% Up', 'Best', 'Worst', String(year)].map(h => (
                  <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'right', padding: '4px 8px', color: 'var(--orange)', fontWeight: 800, textTransform: 'uppercase' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {months.map(m => {
                  const ty = d.this_year[m.name]
                  const cls = (v?: number) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '')
                  return (
                    <tr key={m.m} style={{ background: m.m === d.current_month ? 'rgba(251,191,36,.12)' : undefined, color: 'var(--text)', fontWeight: 700 }}>
                      <td style={{ padding: '3px 8px' }}>{m.name}</td>
                      <td className={`mono ${cls(m.avg)}`} style={{ textAlign: 'right', padding: '3px 8px' }}>{pct(m.avg)}</td>
                      <td className={`mono ${cls(m.median)}`} style={{ textAlign: 'right', padding: '3px 8px' }}>{pct(m.median)}</td>
                      <td className="mono" style={{ textAlign: 'right', padding: '3px 8px' }}>{m.pct_up ?? '—'}%</td>
                      <td className="mono up" style={{ textAlign: 'right', padding: '3px 8px' }}>{m.best ? `${pct(m.best[1])} (${m.best[0]})` : '—'}</td>
                      <td className="mono down" style={{ textAlign: 'right', padding: '3px 8px' }}>{m.worst ? `${pct(m.worst[1])} (${m.worst[0]})` : '—'}</td>
                      <td className={`mono ${cls(ty)}`} style={{ textAlign: 'right', padding: '3px 8px' }}>{ty == null ? '' : pct(ty)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 6 }}>
            A tailwind or headwind, not a signal: read the median with the average (one big year can drag the average), and check the worst year before trusting a strong month.
          </div>
        </>
      )}
    </div>
  )
}

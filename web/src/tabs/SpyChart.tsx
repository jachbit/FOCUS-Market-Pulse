// F.O.C.U.S. Market Weather: SPY daily closes (1M / 3M / 6M / 1Y / 2Y / 5Y) with the Bollinger Band (20, 2) and the 50 / 200-day
// SMAs. The band's middle line IS the 20-day SMA, so it is not drawn twice. Every line is computed over the full history
// first, then cut to the window, so the 200-day is right from the first visible day.
import { useMemo } from 'react'

export type SpyRange = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y'
export const SPY_RANGES: Record<SpyRange, number> = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252, '2Y': 504, '5Y': 1260 }
interface Pt { d: string; c: number; up?: number; mid?: number; lo?: number; s50?: number; s200?: number }
const C = { close: 'var(--text)', bb: 'var(--ind-bb)', sma50: 'var(--ind-sma50)', sma200: 'var(--ind-sma200)' }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function series(bars: [string, number][], days: number): Pt[] {
  const c = bars.map(b => b[1])
  const sma = (i: number, n: number) => (i >= n - 1 ? c.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n : undefined)
  const start = Math.max(0, bars.length - days)
  const out: Pt[] = []
  for (let i = start; i < bars.length; i++) {
    const m = sma(i, 20)
    let up: number | undefined, lo: number | undefined
    if (m !== undefined) {
      const w = c.slice(i - 19, i + 1), sd = Math.sqrt(w.reduce((a, v) => a + (v - m) ** 2, 0) / 20)
      up = m + 2 * sd; lo = m - 2 * sd
    }
    out.push({ d: bars[i][0], c: c[i], up, mid: m, lo, s50: sma(i, 50), s200: sma(i, 200) })
  }
  return out
}

export function SpyChart({ bars, range, onRange }: { bars: [string, number][]; range: SpyRange; onRange: (r: SpyRange) => void }) {
  const view = useMemo(() => series(bars, SPY_RANGES[range]), [bars, range])
  if (view.length < 2) return <div className="note">No SPY history in this build.</div>
  const W = 900, H = 230, P = { l: 52, r: 10, t: 10, b: 22 }
  const vals = view.flatMap(p => [p.c, p.up, p.lo, p.s50, p.s200]).filter((v): v is number => v != null)
  let lo = Math.min(...vals), hi = Math.max(...vals)
  const pad = (hi - lo) * 0.04 || 1
  lo -= pad; hi += pad
  const x = (i: number) => P.l + (i / (view.length - 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b)
  const path = (k: 'c' | 'up' | 'mid' | 'lo' | 's50' | 's200') =>
    view.map((p, i) => (p[k] == null ? null : `${x(i).toFixed(1)},${y(p[k] as number).toFixed(1)}`)).filter(Boolean).join(' ')
  const band = view.map((p, i) => (p.up == null ? null : `${x(i).toFixed(1)},${y(p.up).toFixed(1)}`)).filter(Boolean)
    .concat(view.map((p, i) => (p.lo == null ? null : `${x(i).toFixed(1)},${y(p.lo).toFixed(1)}`)).filter(Boolean).reverse()).join(' ')
  const raw = (hi - lo) / 5, mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw) ?? raw
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  // month labels; on long ranges every quarter (2Y) or every January (5Y), so the axis stays readable
  const every = view.length > 600 ? 12 : view.length > 300 ? 3 : 1
  const months = view.map((p, i) => ({ i, d: p.d })).filter((p, i) => i === 0 || (p.d.slice(5, 7) !== view[i - 1].d.slice(5, 7)
    && (Number(p.d.slice(5, 7)) - 1) % every === 0 && x(i) - x(0) > 70))
  const last = view[view.length - 1]
  const f = (v: number | undefined) => (v == null ? '—' : v.toFixed(2))
  const key = (label: string, color: string, v: number | undefined, dash?: boolean) => (
    <span style={{ whiteSpace: 'nowrap' }}>
      <svg width={18} height={8} style={{ marginRight: 4 }}><line x1={0} x2={18} y1={4} y2={4} stroke={color} strokeWidth={2} strokeDasharray={dash ? '4 3' : undefined} /></svg>
      <span style={{ color }}>{label}</span> <span className="mono">{f(v)}</span>
    </span>
  )
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', gap: 3 }}>
          {(Object.keys(SPY_RANGES) as SpyRange[]).map(r => (
            <button key={r} className={`btn${r === range ? ' on' : ''}`} onClick={() => onRange(r)} title={`Last ${SPY_RANGES[r]} sessions`}>{r}</button>
          ))}
        </span>
        {key('SPY', C.close, last.c)}
        {key('BB upper', C.bb, last.up, true)}
        {key('BB mid = 20-day', C.bb, last.mid)}
        {key('BB lower', C.bb, last.lo, true)}
        {key('50-day', C.sma50, last.s50)}
        {key('200-day', C.sma200, last.s200)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border-soft)" strokeWidth={0.6} />
            <text x={P.l - 5} y={y(v) + 4} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--text)">{v.toFixed(step < 1 ? 1 : 0)}</text>
          </g>
        ))}
        {months.map(p => (
          <text key={p.d} x={x(p.i)} y={H - 5} fontSize={12} fontWeight={700} fill="var(--text)" textAnchor={p.i === 0 ? 'start' : 'middle'}>
            {every === 12 && p.i !== 0 ? p.d.slice(0, 4) : `${MON[Number(p.d.slice(5, 7)) - 1]}${p.i === 0 ? ` ${every > 1 ? `'${p.d.slice(2, 4)}` : p.d.slice(8)}` : every === 3 && p.d.slice(5, 7) === '01' ? ` '${p.d.slice(2, 4)}` : ''}`}
          </text>
        ))}
        {band && <polygon points={band} fill={C.bb} fillOpacity={0.1} stroke="none" />}
        <polyline points={path('up')} fill="none" stroke={C.bb} strokeWidth={1.2} strokeDasharray="5 4" />
        <polyline points={path('lo')} fill="none" stroke={C.bb} strokeWidth={1.2} strokeDasharray="5 4" />
        <polyline points={path('mid')} fill="none" stroke={C.bb} strokeWidth={1.3} />
        <polyline points={path('s200')} fill="none" stroke={C.sma200} strokeWidth={2} />
        <polyline points={path('s50')} fill="none" stroke={C.sma50} strokeWidth={1.6} />
        <polyline points={path('c')} fill="none" stroke={C.close} strokeWidth={view.length > 600 ? 1.6 : 2.4} />
        <circle cx={x(view.length - 1)} cy={y(last.c)} r={4.5} fill={C.close}><title>{`SPY ${last.d}: ${f(last.c)}`}</title></circle>
      </svg>
    </div>
  )
}

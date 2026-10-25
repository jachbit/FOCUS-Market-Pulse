// F.O.C.U.S. Sector Rotation (from the Edge Scanner window): our own relative rotation graph of the 11 SPDR sector
// ETFs against SPY (pulse/rotation.py: RS-Ratio = 40-period z-score of relative strength, RS-Momentum = 20-period
// z-score of the ratio, both centred on 100). Rotation usually runs clockwise: Improving -> Leading -> Weakening ->
// Lagging. Tails show the last N weeks (or days). Double-click a sector (or pick it in View) for its stocks vs its ETF.
import { useMemo, useState } from 'react'
import { useJson, type Quadrant, type RotationPayload, type RotationSeries, type SectorStocksPayload } from '../lib/data'

export const QUAD_COLOR: Record<Quadrant, string> = { Leading: '#22c55e', Weakening: '#eab308', Lagging: '#ef4444', Improving: '#3b82f6' }
const QUAD_FILL: Record<Quadrant, string> = {
  Leading: 'rgba(34,197,94,.13)', Weakening: 'rgba(234,179,8,.13)', Lagging: 'rgba(239,68,68,.13)', Improving: 'rgba(59,130,246,.13)',
}
const SECTOR_COLOR: Record<string, string> = {
  XLK: '#f59e0b', XLF: '#a3e635', XLV: '#10b981', XLE: '#ef4444', XLI: '#94a3b8', XLY: '#fb923c',
  XLP: '#22d3ee', XLU: '#f43f5e', XLB: '#c084fc', XLRE: '#e879f9', XLC: '#facc15',
}
const SECTOR_NAMES: Record<string, string> = {
  XLK: 'Technology', XLF: 'Financials', XLV: 'Health Care', XLE: 'Energy', XLI: 'Industrials', XLY: 'Consumer Discretionary',
  XLP: 'Consumer Staples', XLU: 'Utilities', XLB: 'Materials', XLRE: 'Real Estate', XLC: 'Communication Services',
}
const QUADS: Quadrant[] = ['Leading', 'Improving', 'Weakening', 'Lagging']
const W = 1000, H = 640, PAD = { l: 56, r: 20, t: 16, b: 44 }

export function RotationTab() {
  const [tf, setTf] = useState<'W' | 'D'>('W')
  const [tail, setTail] = useState(10)
  const [view, setView] = useState('sectors')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<string | null>(null)
  const stockView = view !== 'sectors'
  const sec = useJson<RotationPayload>(`rotation_${tf}.json`)
  const stk = useJson<SectorStocksPayload>(stockView ? `sectors/${view}_${tf}.json` : null)
  const data = stockView ? stk.data : sec.data
  const error = (stockView ? stk.error : sec.error) ?? data?.error ?? null
  const bench = stockView ? view : 'SPY'

  // the tails cut to the chosen length (the data holds 20 points)
  const series: Record<string, RotationSeries> = useMemo(() => {
    const src = stockView ? (stk.data?.members ?? {}) : (sec.data?.sectors ?? {})
    return Object.fromEntries(Object.entries(src).map(([k, s]) => [k, { ...s, points: s.points.slice(-tail) }]))
  }, [stockView, stk.data, sec.data, tail])
  const rows = useMemo(() => Object.entries(series).sort((a, b) => b[1].ratio - a[1].ratio), [series])
  const shown = stockView ? rows : rows.filter(([k]) => !hidden.has(k))
  // stock view: label only the 12 strongest moves (farthest from the centre), plus hover
  const labelled = useMemo(() => new Set(stockView
    ? [...rows].sort((a, b) => (Math.abs(b[1].ratio - 100) + Math.abs(b[1].mom - 100)) - (Math.abs(a[1].ratio - 100) + Math.abs(a[1].mom - 100))).slice(0, 12).map(([k]) => k)
    : rows.map(([k]) => k)), [rows, stockView])
  // axes: symmetric around 100, at least +/-3, covering every shown tail point
  const span = useMemo(() => {
    let dx = 3, dy = 3
    for (const [, s] of shown) for (const [, r, m] of s.points) { dx = Math.max(dx, Math.abs(r - 100)); dy = Math.max(dy, Math.abs(m - 100)) }
    return { dx: Math.ceil(dx + 0.5), dy: Math.ceil(dy + 0.5) }
  }, [shown])
  const x = (r: number) => PAD.l + ((r - (100 - span.dx)) / (2 * span.dx)) * (W - PAD.l - PAD.r)
  const y = (m: number) => PAD.t + (1 - (m - (100 - span.dy)) / (2 * span.dy)) * (H - PAD.t - PAD.b)
  const ticks = (d: number) => { const st = d > 8 ? 2 : 1; const o: number[] = []; for (let v = 100 - d; v <= 100 + d + 1e-9; v += st) o.push(v); return o }
  const toggle = (k: string) => { const n = new Set(hidden); if (n.has(k)) n.delete(k); else n.add(k); setHidden(n) }
  const openSector = (k: string) => { setView(k); if (tail > 6) setTail(4) }

  return (
    <div>
      <div className="toolbar">
        <button className={`btn${tf === 'W' ? ' on' : ''}`} onClick={() => setTf('W')}>Weekly</button>
        <button className={`btn${tf === 'D' ? ' on' : ''}`} onClick={() => setTf('D')}>Daily</button>
        <span className="note">Tail</span>
        <select className="input" value={tail} onChange={e => setTail(Number(e.target.value))} style={{ width: 64 }}>
          {[1, 4, 6, 8, 10, 13, 20].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {stockView && <button className="btn" onClick={() => setView('sectors')}>← Sectors</button>}
        <select className="input" value={view} onChange={e => (e.target.value === 'sectors' ? setView('sectors') : openSector(e.target.value))} style={{ width: 240 }}
          title="Sectors vs SPY, or the stocks of one sector vs that sector's ETF (double-click a sector dot too)">
          <option value="sectors">View: Sectors vs SPY</option>
          {Object.entries(SECTOR_NAMES).map(([k, n]) => <option key={k} value={k}>Stocks in {k} ({n}) vs {k}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <span className="note">
          {stockView ? `${stk.data?.count ?? '…'} ${view} stocks ` : ''}vs {bench} · {tf === 'W' ? 'weekly' : 'daily'}{data?.asof ? ` · as of ${data.asof}` : ''}
        </span>
      </div>
      {error && <div className="warn" style={{ padding: '4px 0' }}>{error}</div>}
      {!data ? (!error && <div className="empty">Loading {stockView ? `${view} stocks` : 'sector rotation'}…</div>) : (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', maxHeight: '68vh', display: 'block', background: 'var(--panel)', borderRadius: 8 }}>
          <rect x={x(100)} y={PAD.t} width={x(100 + span.dx) - x(100)} height={y(100) - PAD.t} fill={QUAD_FILL.Leading} />
          <rect x={x(100)} y={y(100)} width={x(100 + span.dx) - x(100)} height={H - PAD.b - y(100)} fill={QUAD_FILL.Weakening} />
          <rect x={PAD.l} y={y(100)} width={x(100) - PAD.l} height={H - PAD.b - y(100)} fill={QUAD_FILL.Lagging} />
          <rect x={PAD.l} y={PAD.t} width={x(100) - PAD.l} height={y(100) - PAD.t} fill={QUAD_FILL.Improving} />
          {ticks(span.dx).map(v => (
            <g key={`x${v}`}>
              <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} stroke="var(--border-soft)" strokeWidth={v === 100 ? 1.5 : 0.5} />
              <text x={x(v)} y={H - PAD.b + 18} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">{v.toFixed(0)}</text>
            </g>
          ))}
          {ticks(span.dy).map(v => (
            <g key={`y${v}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--border-soft)" strokeWidth={v === 100 ? 1.5 : 0.5} />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={13} fontWeight={700} fill="var(--text)">{v.toFixed(0)}</text>
            </g>
          ))}
          <text x={W - PAD.r - 8} y={PAD.t + 22} textAnchor="end" fontSize={18} fontWeight={800} fill={QUAD_COLOR.Leading}>LEADING</text>
          <text x={W - PAD.r - 8} y={H - PAD.b - 10} textAnchor="end" fontSize={18} fontWeight={800} fill={QUAD_COLOR.Weakening}>WEAKENING</text>
          <text x={PAD.l + 8} y={H - PAD.b - 10} fontSize={18} fontWeight={800} fill={QUAD_COLOR.Lagging}>LAGGING</text>
          <text x={PAD.l + 8} y={PAD.t + 22} fontSize={18} fontWeight={800} fill={QUAD_COLOR.Improving}>IMPROVING</text>
          <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">RS-Ratio (relative strength vs {bench}) →</text>
          <text transform={`translate(14 ${(PAD.t + H - PAD.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">RS-Momentum →</text>
          {shown.map(([k, s]) => {
            const c = stockView ? QUAD_COLOR[s.quadrant] : (SECTOR_COLOR[k] ?? '#fff')
            const pts = s.points.map(([, r, m]) => `${x(r)},${y(m)}`).join(' ')
            const [d, r, m] = s.points[s.points.length - 1]
            const dim = !!hover && hover !== k
            const label = labelled.has(k) || hover === k
            return (
              <g key={k} opacity={dim ? 0.22 : 1} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}
                style={{ cursor: stockView ? 'default' : 'pointer' }} onDoubleClick={() => { if (!stockView) openSector(k) }}>
                <title>{`${k}${s.name && s.name !== k ? ` · ${s.name}` : ''}\n${s.quadrant} vs ${bench} · RS-Ratio ${r.toFixed(1)} · RS-Momentum ${m.toFixed(1)}\n${tf === 'W' ? 'week to' : 'day'} ${d}${stockView ? '' : `\nDouble-click: the stocks of ${k} vs ${k}`}`}</title>
                {s.points.length > 1 && <polyline points={pts} fill="none" stroke={c} strokeWidth={stockView ? 1.4 : 2.2} opacity={stockView && !label ? 0.5 : 1} />}
                {s.points.slice(0, -1).map(([pd, pr, pm]) => <circle key={pd} cx={x(pr)} cy={y(pm)} r={stockView ? 2.2 : 3.2} fill={c} />)}
                <circle cx={x(r)} cy={y(m)} r={stockView ? 6 : 8} fill={c} stroke="#000" strokeWidth={1} />
                {label && <text x={x(r) + 10} y={y(m) + 5} fontSize={stockView ? 13 : 15} fontWeight={800} fill="var(--text)">{k}</text>}
              </g>
            )
          })}
        </svg>
      )}
      {data && (stockView ? (
        <div style={{ padding: '8px 0', maxHeight: 220, overflow: 'auto' }}>
          {QUADS.map(q => {
            const list = rows.filter(([, s]) => s.quadrant === q)
            return list.length ? (
              <div key={q} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: QUAD_COLOR[q], width: 112 }}>{q} ({list.length})</span>
                {list.map(([k, s]) => (
                  <span key={k} className="btn" onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}
                    title={`${k}: ${q} vs ${view} (RS-Ratio ${s.ratio.toFixed(1)}, momentum ${s.mom.toFixed(1)})`}
                    style={{ borderColor: QUAD_COLOR[q], padding: '0 6px', cursor: 'default' }}>{k}</span>
                ))}
              </div>
            ) : null
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 0' }}>
          {rows.map(([k, s]) => (
            <button key={k} className="btn" onClick={() => toggle(k)}
              title={`${s.name}: ${s.quadrant} (RS-Ratio ${s.ratio.toFixed(1)}, momentum ${s.mom.toFixed(1)}). Click to ${hidden.has(k) ? 'show' : 'hide'}; double-click its dot for its stocks.`}
              style={{ opacity: hidden.has(k) ? 0.4 : 1, borderColor: QUAD_COLOR[s.quadrant] }}>
              <span style={{ color: SECTOR_COLOR[k] }}>●</span> {k} <span style={{ color: QUAD_COLOR[s.quadrant] }}>{s.quadrant}</span>
            </button>
          ))}
        </div>
      ))}
      <div className="note" style={{ marginTop: 4 }}>
        RS-Ratio (across): is the sector beating {bench}, scored against its own last 40 {tf === 'W' ? 'weeks' : 'days'} (100 = average). RS-Momentum (up):
        is that lead growing (above 100) or fading. Rotation usually runs clockwise: Improving → Leading → Weakening → Lagging. Our own
        public approximation of a Relative Rotation Graph, not a copy of any vendor's chart.
      </div>
    </div>
  )
}

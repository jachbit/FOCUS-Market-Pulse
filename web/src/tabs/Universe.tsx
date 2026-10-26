// F.O.C.U.S. Market Pulse Universe: every ticker the site follows (pulse/universe.txt plus the indexes and sector ETFs),
// with its sector ETF, last close and day's change, and whether Yahoo found it. Adding names: the owner edits the list
// in GitHub's web editor (the site has no server and holds no keys); group members can suggest a ticker.
import { useMemo, useState } from 'react'
import { useJson } from '../lib/data'

interface Row { s: string; g: 'Index' | 'Sector' | 'Stock'; etf: string | null; sector: string; name: string; close: number | null; chg: number | null; ok: boolean }
interface UniversePayload { rows: Row[]; not_found: string[]; counts: Record<string, number> }

const REPO = 'https://github.com/jachbit/FOCUS-Market-Pulse'
const EDIT_URL = `${REPO}/edit/main/pulse/universe.txt`
const SUGGEST_URL = `${REPO}/issues/new?title=${encodeURIComponent('Ticker request: ')}&body=${encodeURIComponent('Please add to Market Pulse:\n\n- Ticker:\n- Why (optional):\n')}`
const GROUPS = ['All', 'Index', 'Sector', 'Stock'] as const

export function UniverseTab() {
  const { data, error } = useJson<UniversePayload>('universe.json')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<typeof GROUPS[number]>('All')
  const [sort, setSort] = useState<{ k: 's' | 'etf' | 'chg'; dir: 1 | -1 }>({ k: 's', dir: 1 })
  const rows = useMemo(() => {
    const t = q.trim().toUpperCase()
    const out = (data?.rows ?? []).filter(r => (group === 'All' || r.g === group)
      && (!t || r.s.includes(t) || (r.etf ?? '').includes(t) || r.sector.toUpperCase().includes(t) || r.name.toUpperCase().includes(t)))
    const v = (r: Row) => (sort.k === 'chg' ? (r.chg ?? -1e9) : sort.k === 'etf' ? (r.etf ?? 'ZZZ') : r.s)
    return out.sort((a, b) => (v(a) < v(b) ? -sort.dir : v(a) > v(b) ? sort.dir : 0))
  }, [data, q, group, sort])
  const th = (label: string, k?: 's' | 'etf' | 'chg', right?: boolean) => (
    <th onClick={k ? () => setSort(s => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 })) : undefined}
      style={{ textAlign: right ? 'right' : 'left', padding: '4px 8px', color: 'var(--orange)', fontWeight: 800, textTransform: 'uppercase', cursor: k ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
      {label}{k && sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>
  )
  const c = data?.counts
  return (
    <div>
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="card-head">Adding or removing names</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <a className="btn" href={EDIT_URL} target="_blank" rel="noopener" title="Opens the list in GitHub's web editor (the owner, signed in to GitHub)">✎ Add or remove tickers</a>
            <a className="btn" href={SUGGEST_URL} target="_blank" rel="noopener" title="Opens a pre-filled request on GitHub">💡 Suggest a ticker</a>
          </div>
          <b>Owner:</b> ✎ opens the list in GitHub's editor: one ticker per line, then <b>Commit changes</b>. The site rebuilds in about
          2-3 minutes and the new names appear here, in Seasonality, in Market Weather's breadth and in their sector's stocks (the sector is
          looked up automatically). <b>Group members:</b> 💡 sends a request (a free GitHub account is needed).
        </div>
      </div>
      <div className="toolbar">
        <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search ticker or sector" style={{ width: 200 }} />
        {GROUPS.map(g => (
          <button key={g} className={`btn${group === g ? ' on' : ''}`} onClick={() => setGroup(g)}>
            {g === 'All' ? 'All' : g === 'Index' ? 'Indexes' : g === 'Sector' ? 'Sector ETFs' : 'Stocks'}{c && g !== 'All' ? ` (${c[g]})` : ''}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span className="note">{c ? `${c.Stock} stocks · ${c.Sector} sector ETFs · ${c.Index} indexes` : ''}{rows.length !== (data?.rows.length ?? 0) ? ` · showing ${rows.length}` : ''}</span>
      </div>
      {data && data.not_found.length > 0 && (
        <div className="warn" style={{ marginBottom: 6 }}>Not found on Yahoo (check the spelling, or it may be delisted): {data.not_found.join(', ')}</div>
      )}
      {error && <div className="warn">{error}</div>}
      {!data ? (!error && <div className="empty">Loading the list…</div>) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
            <thead><tr>{th('Ticker', 's')}{th('Group')}{th('Sector', 'etf')}{th('Last close', undefined, true)}{th('Day', 'chg', true)}{th('Data')}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.s} style={{ borderTop: '1px solid var(--border-soft)', color: 'var(--text)', fontWeight: 700 }}>
                  <td style={{ padding: '3px 8px' }}>
                    <a href={`#seasonality/${r.s}`} style={{ color: '#fff', textDecoration: 'none' }} title={`${r.s}: open its Seasonality`}>{r.s}</a>
                    {r.name && <span style={{ color: 'var(--bluegrey)', fontWeight: 600 }}> · {r.name}</span>}
                  </td>
                  <td style={{ padding: '3px 8px' }}>{r.g === 'Index' ? 'Index' : r.g === 'Sector' ? 'Sector ETF' : 'Stock'}</td>
                  <td style={{ padding: '3px 8px' }}>{r.etf ? <>{r.etf} <span style={{ color: 'var(--bluegrey)', fontWeight: 600 }}>{r.sector}</span></> : r.g === 'Stock' ? '—' : ''}</td>
                  <td className="mono" style={{ padding: '3px 8px', textAlign: 'right' }}>{r.close != null ? r.close.toFixed(2) : '—'}</td>
                  <td className={`mono ${(r.chg ?? 0) > 0 ? 'up' : (r.chg ?? 0) < 0 ? 'down' : ''}`} style={{ padding: '3px 8px', textAlign: 'right' }}>
                    {r.chg != null ? `${r.chg > 0 ? '+' : ''}${r.chg.toFixed(2)}%` : '—'}</td>
                  <td style={{ padding: '3px 8px', color: r.ok ? '#22c55e' : '#ef4444' }}>{r.ok ? '✓ loaded' : '✗ not found'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

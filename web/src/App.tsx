// F.O.C.U.S. Market Pulse (Jachbit 2026): the Edge Scanner's Sector Rotation, Seasonality and Market Weather as one free
// static site. Data: pulse/build.py (yfinance, no account) run by the GitHub Action about hourly in market hours.
import { useEffect, useState } from 'react'
import { etDateText, etTime, useJson, type Meta } from './lib/data'
import { RotationTab } from './tabs/Rotation'
import { SeasonalityTab } from './tabs/Seasonality'
import { WeatherTab } from './tabs/Weather'
import { HelpTab } from './tabs/Help'
import { UniverseTab } from './tabs/Universe'

const TABS = [
  { id: 'weather', label: '☀ Market Weather' },
  { id: 'rotation', label: '◴ Sector Rotation' },
  { id: 'seasonality', label: '▦ Seasonality' },
  { id: 'universe', label: '📋 Universe' },
  { id: 'help', label: '? Help' },
] as const
type TabId = typeof TABS[number]['id']
// "#seasonality/XOM" opens a tab with an argument (the Universe tab links each ticker to its Seasonality)
const hashParts = () => window.location.hash.slice(1).split('/')
const fromHash = (): TabId => (TABS.find(t => t.id === hashParts()[0])?.id ?? 'weather')

function EtClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div className="header-right">
      <div className="hdr-clock-label">Jachbit 2026</div>
      <div className="hdr-time">{new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)}</div>
      <div className="hdr-date">{etDateText(now.toISOString())} | ET</div>
    </div>
  )
}

export function App() {
  const [tab, setTab] = useState<TabId>(fromHash)
  const [arg, setArg] = useState(() => (hashParts()[1] ?? '').toUpperCase())
  const meta = useJson<Meta>('meta.json')
  useEffect(() => {
    const onHash = () => { setTab(fromHash()); setArg((hashParts()[1] ?? '').toUpperCase()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const pick = (id: TabId) => { setTab(id); setArg(''); window.history.replaceState(null, '', `#${id}`) }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="header">
        <div>
          <div className="brand">F.<span>O</span>.C.U.S.<sup style={{ fontSize: 12, color: '#fff' }}>&copy;</sup> <span style={{ color: '#fff' }}>— Market Pulse</span></div>
          <div className="hdr-subtitle">Market Weather · Sector Rotation · Seasonality</div>
          <div className="hdr-copy">&copy; 2026 Jachbit. All rights reserved. May not be shared without consent. · <a href="https://linktr.ee/jachbit" target="_blank" rel="noopener">linktr.ee/jachbit</a></div>
        </div>
        <div className="header-center">
          <div className="hdr-disclaimer-title">&#9888;&nbsp; Disclaimer: TRADING IS RISKY!</div>
          <div className="hdr-disclaimer-body">This is for personal research only and not financial advice.</div>
        </div>
        <EtClock />
      </div>
      <div className="tabs">
        {TABS.map(t => <button key={t.id} className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => pick(t.id)}>{t.label}</button>)}
        <span className="updated" title={meta.data ? `Data: ${meta.data.source}. Parts: ${Object.entries(meta.data.parts).map(([k, v]) => `${k} ${v}`).join(', ')}` : undefined}>
          {meta.data ? <>Data updated <b>{etDateText(meta.data.built)} {etTime(meta.data.built)}</b> · about hourly in market hours · delayed</> : meta.error ? 'No data in this build yet' : 'Loading…'}
        </span>
      </div>
      <main style={{ flex: 1 }}>
        {tab === 'rotation' && <RotationTab />}
        {tab === 'seasonality' && <SeasonalityTab key={arg || 'SPY'} initial={arg || 'SPY'} />}
        {tab === 'universe' && <UniverseTab />}
        {tab === 'weather' && <WeatherTab />}
        {tab === 'help' && <HelpTab />}
      </main>
      <div className="footer">
        Data: Yahoo Finance via yfinance (delayed, may contain errors) · math: the F.O.C.U.S. Edge Scanner · For personal research only, not financial advice.
        <br />&copy; 2026 Jachbit. All rights reserved. May not be copied or shared without express written consent of the publisher. · <a href="https://linktr.ee/jachbit" target="_blank" rel="noopener">linktr.ee/jachbit</a>
      </div>
    </div>
  )
}

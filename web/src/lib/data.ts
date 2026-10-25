// F.O.C.U.S. Market Pulse: the JSON the data job writes (pulse/build.py), served next to the page.
import { useEffect, useState } from 'react'

export type Quadrant = 'Leading' | 'Weakening' | 'Lagging' | 'Improving'
export interface RotationSeries { quadrant: Quadrant; ratio: number; mom: number; points: [string, number, number][]; name: string }
export interface RotationPayload { tf: 'W' | 'D'; bench: string; asof: string | null; sectors: Record<string, RotationSeries>; error: string | null }
export interface SectorStocksPayload { tf: 'W' | 'D'; bench: string; name: string; asof: string | null; count: number; members: Record<string, RotationSeries>; error: string | null }
export interface Meta { built: string; source: string; stocks: number; daily_loaded: number; parts: Record<string, string> }
export interface SeasonIndex { symbols: { s: string; g: 'Index' | 'Sector' | 'Stock'; name: string }[] }
export interface SeasonMonthly { symbol: string; monthly: [string, number][] }
export interface WeatherPayload {
  asof: string | null; score: number | null; universe?: number; computed_at?: string
  weather?: { name: 'Clear' | 'Mixed' | 'Stormy' | null; icon: string | null; size: string | null }
  components?: { key: string; label: string; weight: number; score: number | null }[]
  vix?: { vix: number; avg10: number; band: string; pctile: number | null; dir: string; vix3m?: number; ratio?: number; structure?: string; vix9d?: number } | null
  breadth?: { above20: number | null; above50: number | null; above200: number | null; advancers: number | null; adv: number; dec: number; highs: number; lows: number; n: number; asof: string } | null
  spy?: { close: number; sma20: number | null; sma50: number | null; sma200: number | null; hi252: number | null } | null
  sectors?: { good: number; total: number; leading: string[]; improving: string[] } | null
  hint?: string | null; warnings?: string[]; history?: [string, number][]; error: string | null
  rates?: { y10?: number; chg20_bp?: number | null; y3m?: number | null; curve?: number | null; credit_dev?: number; dollar_chg?: number } | null
  rates_hint?: string | null
  spy_bars?: [string, number][]
}

const cache = new Map<string, Promise<unknown>>()
export function getJson<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(`./data/${path}`, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`)
      return r.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p as Promise<T>
}

/** Load one data file; re-renders when it arrives (or fails). */
export function useJson<T>(path: string | null): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null })
  useEffect(() => {
    if (!path) return
    let live = true
    getJson<T>(path).then(d => { if (live) setState({ path, data: d, error: null }) },
      e => { if (live) setState({ path, data: null, error: e instanceof Error ? e.message : String(e) }) })
    return () => { live = false }
  }, [path])
  return state.path === path ? { data: state.data, error: state.error } : { data: null, error: null }
}

/** "3:15 PM ET" from an ISO time. */
export const etTime = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)) + ' ET' : '')
export const etDateText = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : '')

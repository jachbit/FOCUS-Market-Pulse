// F.O.C.U.S. seasonality (the Edge Scanner's scanner/seasonality.py, ported): for the last `years` complete years, each
// calendar month's return (close to close): average, median, % of years up, best and worst year; plus this year so far.
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface SeasonMonth { m: number; name: string; n: number; avg?: number; median?: number; pct_up?: number; best?: [number, number]; worst?: [number, number] }
export interface Season { years: number; from: number | null; to: number | null; months: SeasonMonth[]; this_year: Record<string, number>; current_month: number }

const r2 = (v: number) => Math.round(v * 100) / 100

/** {"YYYY-M": % return from the previous month's close} for consecutive months. */
function monthlyReturns(monthly: [string, number][]): Map<string, { y: number; m: number; r: number }> {
  const pts = monthly.map(([ym, c]) => ({ y: Number(ym.slice(0, 4)), m: Number(ym.slice(5, 7)), c })).filter(p => p.c > 0)
    .sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m))
  const out = new Map<string, { y: number; m: number; r: number }>()
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    if (b.y * 12 + b.m - (a.y * 12 + a.m) === 1) out.set(`${b.y}-${b.m}`, { y: b.y, m: b.m, r: (b.c / a.c - 1) * 100 })
  }
  return out
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b), n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

export function seasonality(monthly: [string, number][], years: number, today = new Date()): Season {
  const rets = [...monthlyReturns(monthly).values()]
  const year = today.getFullYear(), first = year - years
  const months: SeasonMonth[] = []
  for (let m = 1; m <= 12; m++) {
    const xs = rets.filter(x => x.m === m && x.y >= first && x.y < year)
    if (!xs.length) { months.push({ m, name: MONTHS[m - 1], n: 0 }); continue }
    const vals = xs.map(x => x.r)
    const best = xs.reduce((a, b) => (b.r > a.r ? b : a)), worst = xs.reduce((a, b) => (b.r < a.r ? b : a))
    months.push({
      m, name: MONTHS[m - 1], n: vals.length, avg: r2(vals.reduce((a, b) => a + b, 0) / vals.length), median: r2(median(vals)),
      pct_up: Math.round(100 * vals.filter(v => v > 0).length / vals.length), best: [best.y, r2(best.r)], worst: [worst.y, r2(worst.r)],
    })
  }
  const thisYear: Record<string, number> = {}
  for (const x of rets.filter(x => x.y === year).sort((a, b) => a.m - b.m)) thisYear[MONTHS[x.m - 1]] = r2(x.r)
  const counted = rets.filter(x => x.y >= first && x.y < year).map(x => x.y)
  return { years, from: counted.length ? Math.min(...counted) : null, to: counted.length ? Math.max(...counted) : null,
    months, this_year: thisYear, current_month: today.getMonth() + 1 }
}

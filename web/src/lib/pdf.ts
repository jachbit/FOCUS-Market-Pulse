// F.O.C.U.S. Market Pulse PDF (Jachbit 2026): the Edge Scanner's report template (scanner/pdf_report.py) redrawn in the
// browser with jsPDF, since the site has no server. Same frame: title / date header with a thin rule, the
// "Jachbit 2026 · date · subtitle" byline, section headers as a light grey band with an accent left bar and underline
// (never a solid brand-colour fill), and the 3-line footer. jsPDF loads only when a PDF is asked for.
type RGB = [number, number, number]
const NAVY: RGB = [0, 43, 92], ORANGE: RGB = [230, 92, 0], DARK: RGB = [68, 68, 68], BLACK: RGB = [0, 0, 0]
const MID: RGB = [209, 209, 209], LIGHT: RGB = [240, 240, 240]
const COLORS: Record<string, RGB> = { navy: NAVY, orange: ORANGE, blue: [59, 130, 246], green: [22, 140, 60], red: [200, 30, 30], grey: DARK }

export type Section =
  | { kind: 'kv'; title: string; rows: [string, string][]; perRow?: number }
  | { kind: 'lines'; title: string; x: string[]; series: { label: string; values: (number | null | undefined)[]; color: string; dash?: boolean; width?: number }[]; height?: number; note?: string; yMin?: number; yMax?: number }
  | { kind: 'note'; title?: string; text: string }

const PAGE_W = 612, PAGE_H = 792, ML = 40, MR = 40, TOP = 40, BOTTOM = 66, CW = PAGE_W - ML - MR
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const two = (n: number) => String(n).padStart(2, '0')

export async function downloadReport(title: string, subtitle: string, fileStem: string, sections: Section[]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const now = new Date()
  const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`
  const stamp = `${date.replace(/-/g, '')}_${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  let y = TOP + 14
  const room = (h: number) => { if (y + h > PAGE_H - BOTTOM) { doc.addPage(); y = TOP + 14 } }

  // title + byline (what this PDF covers: a printed page shows no filename)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); color(NAVY)
  doc.text(title, ML, y + 6); y += 20
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(DARK)
  const by = doc.splitTextToSize(`Jachbit 2026  ·  ${date} ${two(now.getHours())}:${two(now.getMinutes())}  ·  ${subtitle}`, CW) as string[]
  doc.text(by, ML, y); y += by.length * 11 + 6

  const bar = (text: string) => {
    room(40)
    doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]); stroke(MID); doc.setLineWidth(0.4)
    doc.rect(ML, y, CW, 16, 'FD')
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]); doc.rect(ML, y, 3.5, 16, 'F')         // accent left bar
    stroke(NAVY); doc.setLineWidth(0.8); doc.line(ML, y + 16, ML + CW, y + 16)           // accent underline
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); color(NAVY)
    doc.text(text, ML + 9, y + 11.2); y += 22
  }

  for (const s of sections) {
    if (s.title) bar(s.title)
    if (s.kind === 'kv') {
      const per = s.perRow ?? 2, cw = CW / per
      for (let i = 0; i < s.rows.length; i += per) {
        const cells = s.rows.slice(i, i + per).map(([k, v]) => {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
          const kw = doc.getTextWidth(`${k}: `)
          doc.setFont('helvetica', 'normal')
          return { k, kw, lines: doc.splitTextToSize(v, Math.max(40, cw - kw - 8)) as string[] }
        })
        const h = Math.max(...cells.map(c => c.lines.length)) * 10.5 + 3
        room(h)
        cells.forEach((c, j) => {
          const x = ML + 4 + j * cw
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); color(DARK); doc.text(`${c.k}:`, x, y + 8)
          doc.setFont('helvetica', 'normal'); color(BLACK); doc.text(c.lines, x + c.kw, y + 8)
        })
        y += h
      }
      y += 6
    } else if (s.kind === 'note') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(BLACK)
      const lines = doc.splitTextToSize(s.text, CW - 8) as string[]
      room(lines.length * 10.5 + 6)
      doc.text(lines, ML + 4, y + 8); y += lines.length * 10.5 + 8
    } else {
      const H = s.height ?? 170, PL = 40, PB = 16
      room(H + 22)
      const vals = s.series.flatMap(se => se.values.filter((v): v is number => v != null))
      let lo = s.yMin ?? Math.min(...vals), hi = s.yMax ?? Math.max(...vals)
      if (s.yMin == null) { const pad = (hi - lo) * 0.04 || 1; lo -= pad; hi += pad }
      const x0 = ML + PL, x1 = ML + CW - 4, yTop = y + 4, yBot = y + H - PB
      const X = (i: number) => x0 + (s.x.length > 1 ? (i / (s.x.length - 1)) * (x1 - x0) : 0)
      const Y = (v: number) => yBot - ((v - lo) / (hi - lo)) * (yBot - yTop)
      stroke(MID); doc.setLineWidth(0.4)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); color(DARK)
      for (let k = 0; k <= 4; k++) {
        const v = lo + ((hi - lo) * k) / 4
        doc.line(x0, Y(v), x1, Y(v))
        doc.text(v.toFixed(hi - lo >= 20 ? 0 : hi - lo >= 2 ? 1 : 2), x0 - 4, Y(v) + 2.5, { align: 'right' })
      }
      // x labels: each month, every quarter past ~300 points, every January past ~600
      const every = s.x.length > 600 ? 12 : s.x.length > 300 ? 3 : 1
      let last = -1e9
      s.x.forEach((d, i) => {
        if (i === 0 || d.slice(5, 7) === s.x[i - 1].slice(5, 7) || (Number(d.slice(5, 7)) - 1) % every !== 0 || X(i) - last < 34) return
        const lab = every === 12 ? d.slice(0, 4) : `${MON[Number(d.slice(5, 7)) - 1]}${d.slice(5, 7) === '01' ? ` '${d.slice(2, 4)}` : ''}`
        doc.text(lab, X(i), yBot + 10, { align: 'center' }); last = X(i)
      })
      for (const se of s.series) {
        const c = COLORS[se.color] ?? DARK
        stroke(c); doc.setLineWidth(se.width ?? 1)
        doc.setLineDashPattern(se.dash ? [2.5, 2] : [], 0)
        let prev: [number, number] | null = null
        se.values.forEach((v, i) => {
          if (v == null) { prev = null; return }
          const p: [number, number] = [X(i), Y(v)]
          if (prev) doc.line(prev[0], prev[1], p[0], p[1])
          prev = p
        })
      }
      doc.setLineDashPattern([], 0)
      y += H
      // legend
      let lx = x0
      doc.setFontSize(7.5)
      for (const se of s.series) {
        const c = COLORS[se.color] ?? DARK
        stroke(c); doc.setLineWidth(se.width ?? 1); doc.setLineDashPattern(se.dash ? [2.5, 2] : [], 0)
        doc.line(lx, y + 2, lx + 14, y + 2); doc.setLineDashPattern([], 0)
        color(DARK); doc.text(se.label, lx + 17, y + 4.5)
        lx += 24 + doc.getTextWidth(se.label)
      }
      y += 12
      if (s.note) { color(DARK); doc.text(s.note, x0, y + 4); y += 10 }
      y += 6
    }
  }

  // header and 3-line footer on every page
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); color(NAVY); doc.text(title, ML, 22)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); color(DARK); doc.text(`Jachbit 2026  |  ${date}`, PAGE_W - MR, 22, { align: 'right' })
    stroke(MID); doc.setLineWidth(0.5); doc.line(ML, 26, PAGE_W - MR, 26)
    doc.setLineWidth(0.4); doc.line(ML, PAGE_H - 54, PAGE_W - MR, PAGE_H - 54)
    doc.setFontSize(6.5); color(DARK); doc.text('F.O.C.U.S.©  |  Jachbit 2026  |  Market Pulse', PAGE_W / 2, PAGE_H - 44, { align: 'center' })
    doc.setFont('helvetica', 'bold'); color(NAVY); doc.text(`Page ${p} of ${pages}`, PAGE_W - MR, PAGE_H - 44, { align: 'right' })
    doc.setFontSize(6); color(BLACK)
    doc.text('John 3:16   |   1 John 3:16   |   Matt 6:33   |   Jer 33:3   |   Prov 3:5-6   |   Prov 27:17', PAGE_W / 2, PAGE_H - 33, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); color(DARK)
    doc.text('© 2026 Jachbit. All rights reserved. May not be copied or shared without express written consent of the publisher.  linktr.ee/jachbit', PAGE_W / 2, PAGE_H - 22, { align: 'center' })
  }
  doc.setProperties({ title, author: 'Jachbit 2026', subject: subtitle })
  doc.save(`FOCUS_Market_Pulse_${fileStem}_${stamp}.pdf`)
}

/** A CSV download (Excel-friendly), timestamped like the PDFs. */
export function downloadCsv(fileStem: string, header: string[], rows: (string | number | null | undefined)[][]): void {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const text = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
  const now = new Date()
  const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}_${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  a.download = `FOCUS_Market_Pulse_${fileStem}_${stamp}.csv`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

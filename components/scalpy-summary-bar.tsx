'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ScalpySummary, ScalpyTrade } from '@/types/scalpy'

interface Props {
  summary: ScalpySummary
}

interface Stat {
  label: string
  value: string
  valueClass?: string
  hero?: boolean
}

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:4001'
const PNL_FROM_DATE_KEY = 'scalpy:pnl-from-date'

function istanbulDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(iso))
}

function todayIstanbulDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

export function ScalpySummaryBar({ summary }: Props) {
  const [fromDate, setFromDate] = useState(() => {
    if (typeof window === 'undefined') return ''
    const saved = localStorage.getItem(PNL_FROM_DATE_KEY)
    return saved && /^\d{4}-\d{2}-\d{2}$/.test(saved) ? saved : ''
  })
  const [rangeTotalPnl, setRangeTotalPnl] = useState<number | null>(null)
  const todayDate = useMemo(() => todayIstanbulDay(), [])

  useEffect(() => {
    let cancelled = false

    if (!fromDate) {
      localStorage.removeItem(PNL_FROM_DATE_KEY)
      return () => { cancelled = true }
    }

    localStorage.setItem(PNL_FROM_DATE_KEY, fromDate)

    ;(async () => {
      try {
        const res = await fetch(`${ENGINE_URL}/api/scalpy/trades?limit=2000`, { cache: 'no-store' })
        const json = await res.json()
        const trades: ScalpyTrade[] = Array.isArray(json?.trades) ? json.trades : []
        const pnl = trades
          .filter(t => t.status === 'SETTLED' && istanbulDay(t.created_at) >= fromDate)
          .reduce((sum, t) => sum + (t.pnl ?? 0), 0)
        if (!cancelled) setRangeTotalPnl(Math.round(pnl * 100) / 100)
      } catch {
        if (!cancelled) setRangeTotalPnl(null)
      }
    })()

    return () => { cancelled = true }
  }, [fromDate])

  const shownTotalPnl = fromDate && rangeTotalPnl != null ? rangeTotalPnl : summary.totalPnl
  const pnlColor = shownTotalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const todayColor = summary.todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'

  const stats: Stat[] = [
    { label: 'Total Bets', value: String(summary.total) },
    {
      label: 'Win Rate',
      value: summary.winRate !== null ? `${summary.winRate}%` : '—',
    },
    {
      label: 'Total P&L',
      value: shownTotalPnl !== undefined
        ? `${shownTotalPnl >= 0 ? '+' : ''}£${shownTotalPnl.toFixed(2)}`
        : '—',
      valueClass: pnlColor,
      hero: true,
    },
    {
      label: "Today's P&L",
      value: summary.todayPnl !== undefined
        ? `${summary.todayPnl >= 0 ? '+' : ''}£${summary.todayPnl.toFixed(2)}`
        : '—',
      valueClass: todayColor,
    },
  ]

  // One instrument band, hairline-divided cells (the homepage stats-band anatomy) —
  // not a stack of identical cards. Cell borders per index: 2x2 on mobile, 1x4 from sm.
  const cellBorders = [
    'border-b sm:border-b-0 border-r',
    'border-b sm:border-b-0 sm:border-r',
    'border-r',
    '',
  ]

  return (
    <div className="sc-card sc-rise overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {stats.map(({ label, value, valueClass, hero }, i) => (
          <div
            key={label}
            className={`flex flex-col gap-1.5 px-4 py-4 sm:py-5 border-[var(--sc-hairline)] ${cellBorders[i]} ${hero ? (summary.totalPnl >= 0 ? 'sc-strip-pos' : 'sc-strip-neg') : ''}`}
          >
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.15em]">{label}</div>
            <div
              className={hero
                ? `text-3xl sm:text-4xl sc-money leading-none ${valueClass}`
                : `text-xl sm:text-2xl sc-money ${valueClass ?? 'text-zinc-100'}`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-[var(--sc-hairline)] bg-zinc-950/40">
        <label htmlFor="scalpy-pnl-from-date" className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
          Total P&amp;L from
        </label>
        <input
          id="scalpy-pnl-from-date"
          type="date"
          value={fromDate}
          max={todayDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-8 rounded-md border border-[var(--sc-hairline)] bg-zinc-900/80 px-2.5 font-mono text-xs text-zinc-200 outline-none focus:border-sky-400/70"
        />
      </div>
    </div>
  )
}

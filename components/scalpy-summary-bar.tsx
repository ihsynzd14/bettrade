'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ScalpySummary, ScalpyTrade } from '@/types/scalpy'

interface Props {
  summary: ScalpySummary
  trades: ScalpyTrade[]
}

interface Stat {
  label: string
  value: string
  valueClass?: string
  hero?: boolean
}

const PNL_FROM_DATE_KEY = 'scalpy:pnl-from-date'

function istanbulDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(iso))
}

function formatDisplayDate(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function todayIstanbulDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

function clearableDate(onClear: () => void) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center rounded-md border border-[var(--sc-hairline)] bg-zinc-900/60 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-400 transition-colors hover:border-sky-400/60 hover:text-sky-300"
    >
      Reset
    </button>
  )
}

export function ScalpySummaryBar({ summary, trades }: Props) {
  const [mounted, setMounted] = useState(false)
  const [fromDate, setFromDate] = useState(() => {
    if (typeof window === 'undefined') return ''
    const saved = localStorage.getItem(PNL_FROM_DATE_KEY)
    return saved && /^\d{4}-\d{2}-\d{2}$/.test(saved) ? saved : ''
  })
  const [rangeTotalPnl, rangeCount] = useMemo(() => {
    if (!fromDate) return [null, 0] as const
    let pnl = 0
    let count = 0
    for (const trade of trades) {
      if (trade.status !== 'SETTLED') continue
      if (istanbulDay(trade.created_at) < fromDate) continue
      pnl += trade.pnl ?? 0
      count += 1
    }
    return [Math.round(pnl * 100) / 100, count] as const
  }, [fromDate, trades])
  const todayDate = useMemo(() => todayIstanbulDay(), [])
  const rangeLabel = fromDate ? `${formatDisplayDate(fromDate)} → Today` : null

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!fromDate) {
      localStorage.removeItem(PNL_FROM_DATE_KEY)
      return
    }
    localStorage.setItem(PNL_FROM_DATE_KEY, fromDate)
  }, [fromDate])

  const shownTotalPnl = fromDate && rangeTotalPnl != null ? rangeTotalPnl : summary.totalPnl
  const pnlColor = shownTotalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const todayColor = summary.todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const heroStrip = shownTotalPnl >= 0 ? 'sc-strip-pos' : 'sc-strip-neg'

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
            className={`flex flex-col gap-1.5 px-4 py-4 sm:py-5 border-[var(--sc-hairline)] ${cellBorders[i]} ${hero ? heroStrip : ''}`}
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
      <div className="border-t border-[var(--sc-hairline)] bg-gradient-to-r from-zinc-950/95 via-zinc-950/80 to-slate-950/70 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Range filter</div>
            <div className="mt-1 text-sm text-zinc-300">
              <span className="text-zinc-500">Range total uses settled bets from</span>{' '}
              <span className="font-semibold text-zinc-100">{rangeLabel ?? 'the full history'}</span>
              {fromDate && (
                <span className="text-zinc-500"> · {rangeCount} settled bet{rangeCount !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              Saved locally in this browser. Day boundary follows Europe/Istanbul.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mounted ? (
              <>
                <label htmlFor="scalpy-pnl-from-date" className="sr-only">Total P&L from</label>
                <input
                  id="scalpy-pnl-from-date"
                  type="date"
                  value={fromDate}
                  max={todayDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 rounded-md border border-[var(--sc-hairline)] bg-zinc-900/80 px-3 font-mono text-xs text-zinc-100 outline-none transition-colors focus:border-sky-400/70 focus:ring-1 focus:ring-sky-400/20"
                />
                {fromDate && clearableDate(() => setFromDate(''))}
              </>
            ) : (
              <div className="h-9 w-56 rounded-md border border-[var(--sc-hairline)] bg-zinc-900/50 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

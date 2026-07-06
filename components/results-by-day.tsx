'use client'

import { useMemo, useState } from 'react'
import type { ScalpyTrade } from '@/types/scalpy'
import { ScalpyTradesTable } from './scalpy-trades-table'

// YYYY-MM-DD in Europe/Istanbul (the trading day boundary the engine uses).
function istanbulDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(iso))
}

interface DayGroup {
  date: string
  all: ScalpyTrade[]
  count: number
  settled: number
  won: number
  pnl: number
  friendlyN: number
  friendlyPnl: number
}

export function ResultsByDay({ trades }: { trades: ScalpyTrade[] }) {
  const [open, setOpen] = useState<string | null>(null)

  const days = useMemo<DayGroup[]>(() => {
    const map = new Map<string, ScalpyTrade[]>()
    for (const t of trades) {
      const d = istanbulDay(t.created_at)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(t)
    }
    return [...map.entries()]
      .map(([date, ts]) => {
        const settled = ts.filter(t => t.status === 'SETTLED')
        const won = settled.filter(t => t.outcome === 'WON').length
        const pnl = settled.reduce((s, t) => s + (t.pnl ?? 0), 0)
        const friendly = settled.filter(t => t.strategy === 'friendly')
        const friendlyPnl = friendly.reduce((s, t) => s + (t.pnl ?? 0), 0)
        return { date, all: ts, count: ts.length, settled: settled.length, won, pnl, friendlyN: friendly.length, friendlyPnl }
      })
      .sort((a, b) => b.date.localeCompare(a.date)) // newest day first
  }, [trades])

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-zinc-500 font-mono text-sm">
        <span className="sc-live-dot text-sky-400" />
        No results yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {days.map(d => {
        const isOpen = open === d.date
        return (
          <div key={d.date} className="sc-card sc-lift overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : d.date)}
              aria-expanded={isOpen}
              className={`group w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03] cursor-pointer font-mono text-sm transition-colors ${d.pnl >= 0 ? 'sc-strip-pos' : 'sc-strip-neg'}`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-zinc-500 w-3 group-hover:text-[var(--sc-accent)]">{isOpen ? '▾' : '▸'}</span>
                <span className="text-white font-semibold tabular-nums">{d.date}</span>
                <span className="text-zinc-500">{d.count} bet{d.count !== 1 ? 's' : ''}</span>
                {d.settled > 0 && (
                  <span className="text-zinc-500 hidden sm:inline">{Math.round((100 * d.won) / d.settled)}% win · {d.won}/{d.settled}</span>
                )}
                {d.friendlyN > 0 && (
                  <span className="sc-pill sc-pill-violet hidden md:inline-flex" title="Friendly-strategy bets on this day">
                    friendly {d.friendlyN}: {d.friendlyPnl >= 0 ? '+' : ''}£{d.friendlyPnl.toFixed(2)}
                  </span>
                )}
              </span>
              <span className={`sc-money text-base shrink-0 ${d.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {d.pnl >= 0 ? '+' : ''}£{d.pnl.toFixed(2)}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-white/10 p-3">
                <ScalpyTradesTable trades={d.all} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

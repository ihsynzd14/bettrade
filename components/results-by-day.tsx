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
      <div className="sc-card flex flex-col items-center gap-3 py-16 text-zinc-500 font-mono text-sm">
        <span className="sc-live-dot text-sky-400" />
        No results yet.
      </div>
    )
  }

  return (
    // One ledger panel — days are hairline-divided rows inside a single frame
    // (the homepage execution-panel anatomy), not a stack of identical cards.
    <div className="sc-card overflow-hidden divide-y divide-[var(--sc-hairline)]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500">Daily P&amp;L Ledger</span>
        <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{days.length} days</span>
      </div>
      {days.map(d => {
        const isOpen = open === d.date
        return (
          <div key={d.date}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : d.date)}
              aria-expanded={isOpen}
              className={`group w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-sky-500/5 cursor-pointer font-mono text-sm transition-colors duration-300 ${d.pnl >= 0 ? 'sc-strip-pos' : 'sc-strip-neg'}`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <svg
                  className={`sc-nav-motion w-3.5 h-3.5 shrink-0 text-zinc-500 group-hover:text-sky-400 ${isOpen ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                <span className="text-zinc-50 font-semibold tabular-nums">{d.date}</span>
                <span className="text-zinc-500 text-[11px]">
                  <span className="text-sky-500/40 mr-3 text-[9px] align-middle">◆</span>
                  {d.count} bet{d.count !== 1 ? 's' : ''}
                </span>
                {d.settled > 0 && (
                  <span className="text-zinc-500 text-[11px] hidden sm:inline">
                    <span className="text-sky-500/40 mr-3 text-[9px] align-middle">◆</span>
                    {Math.round((100 * d.won) / d.settled)}% win · {d.won}/{d.settled}
                  </span>
                )}
                {d.friendlyN > 0 && (
                  // Responsive gate lives on the WRAPPER: .sc-pill's own `display:inline-flex` is
                  // declared after Tailwind's utilities, so `hidden` directly on the pill loses.
                  <span className="hidden md:inline-flex" title="Friendly-strategy bets on this day">
                    <span className="sc-pill sc-pill-violet">
                      friendly {d.friendlyN}: {d.friendlyPnl >= 0 ? '+' : ''}£{d.friendlyPnl.toFixed(2)}
                    </span>
                  </span>
                )}
              </span>
              <span className={`sc-money text-base shrink-0 ${d.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {d.pnl >= 0 ? '+' : ''}£{d.pnl.toFixed(2)}
              </span>
            </button>
            {isOpen && (
              <div className="sc-rise border-t border-[var(--sc-hairline)] bg-zinc-950/50 p-3">
                <ScalpyTradesTable trades={d.all} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

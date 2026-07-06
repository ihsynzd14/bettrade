'use client'

import { Fragment, useState } from 'react'
import type { ScalpyTrade } from '@/types/scalpy'

interface Props {
  trades: ScalpyTrade[]
}

function pnlDisplay(trade: ScalpyTrade): string {
  if (trade.pnl === null) return '—'
  const sign = trade.pnl >= 0 ? '+' : ''
  return `${sign}£${trade.pnl.toFixed(2)}`
}

function pnlClass(pnl: number | null): string {
  if (pnl === null) return 'text-zinc-500'
  return pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
}

export function ScalpyTradesTable({ trades }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-zinc-500 font-mono text-sm">
        <span className="sc-live-dot text-sky-400" />
        No bets placed today yet. Scalpy bets at 2nd-half stoppage time.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto scrollbar-none">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-white/10 text-zinc-500 text-left">
            {['Time', 'Match', 'Market', 'Side', 'Price', 'Stake', 'Status', 'Outcome', 'P&L', 'Mode'].map(h => (
              <th
                key={h}
                className={`py-2 pr-4 font-medium uppercase tracking-wider text-[10px] ${['Price', 'Stake', 'P&L'].includes(h) ? 'text-right' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--sc-hairline-2)]">
          {trades.map(trade => {
            const isOpen = open === trade.id
            const hasLog = !!trade.stoppage_log
            return (
              <Fragment key={trade.id}>
                <tr
                  className={`group transition-colors ${isOpen ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]'} ${hasLog ? 'cursor-pointer' : ''}`}
                  onClick={hasLog ? () => setOpen(isOpen ? null : trade.id) : undefined}
                  title={hasLog ? 'Click to see the post-90′ timeline' : undefined}
                >
                  <td className={`py-2.5 pr-4 pl-3 text-zinc-400 whitespace-nowrap ${trade.outcome === 'WON' ? 'sc-strip-pos' : trade.outcome === 'LOST' ? 'sc-strip-neg' : ''}`}>
                    {hasLog && <span className="text-zinc-600 group-hover:text-[var(--sc-accent)] mr-1">{isOpen ? '▾' : '▸'}</span>}
                    {new Date(trade.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-100 font-medium">
                    {trade.home_team} v {trade.away_team}
                    {trade.strategy === 'friendly' && (
                      <span className="sc-pill sc-pill-violet ml-2 align-middle">Friendly</span>
                    )}
                    <div className="text-zinc-600 text-[10px]">
                      {trade.strategy === 'friendly'
                        ? `friendly ${trade.added_minutes}′${trade.first_half_added != null ? ` · 1H+${trade.first_half_added}` : ''}`
                        : `${trade.added_minutes}min stoppage`}
                      {trade.bust_goals && trade.outcome !== 'WON' && (
                        <span className="text-rose-400/90" title="Goal(s) that busted the Under — clock + score"> · ⚽ {trade.bust_goals}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-sky-400">
                    {trade.market_type.replace('OVER_UNDER_', 'U/O ').replace(/(\d)(\d)$/, '$1.$2')}
                    {trade.home_goals != null && trade.away_goals != null && (
                      <span className="text-zinc-500 tabular-nums" title="Score when the bet was placed"> ({trade.home_goals}-{trade.away_goals})</span>
                    )}
                    <div className="text-zinc-500">{trade.selection}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`sc-pill ${trade.side === 'BACK' ? 'sc-pill-accent' : 'sc-pill-neg'}`}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-100">{trade.requested_price.toFixed(2)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-400">£{trade.stake}</td>
                  <td className="py-2.5 pr-4">
                    {trade.status === 'PENDING' ? (
                      <span className="sc-pill sc-pill-warn"><span className="sc-live-dot text-amber-400" />PENDING</span>
                    ) : (
                      <span className="sc-pill sc-pill-neutral">{trade.status}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {trade.outcome === 'WON' ? (
                      <span className="sc-pill sc-pill-pos">WON</span>
                    ) : trade.outcome === 'LOST' ? (
                      <span className="sc-pill sc-pill-neg">LOST</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className={`py-2.5 pr-4 text-right tabular-nums font-semibold text-[13px] ${pnlClass(trade.pnl)}`}>
                    {pnlDisplay(trade)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {trade.dry_run ? (
                      <span className="sc-pill sc-pill-warn">DRY</span>
                    ) : (
                      <span className="sc-pill sc-pill-pos">LIVE</span>
                    )}
                  </td>
                </tr>
                {isOpen && hasLog && (
                  <tr className="bg-black/20">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="sc-rise">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 mb-2">
                          Post-90′ timeline · {trade.home_team} v {trade.away_team}
                        </div>
                        <pre className="text-[11px] leading-relaxed text-zinc-300 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono border border-white/10 rounded-lg bg-black/40 p-3">
                          {trade.stoppage_log}
                        </pre>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

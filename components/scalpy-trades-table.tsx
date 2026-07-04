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
      <div className="text-center py-16 text-zinc-600 font-mono text-sm">
        No bets placed today yet. Scalpy bets at 2nd-half stoppage time.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-white/10 text-zinc-500 text-left">
            {['Time', 'Match', 'Market', 'Side', 'Price', 'Stake', 'Status', 'Outcome', 'P&L', 'Mode'].map(h => (
              <th key={h} className="py-2 pr-4 font-medium uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {trades.map(trade => {
            const isOpen = open === trade.id
            const hasLog = !!trade.stoppage_log
            return (
              <Fragment key={trade.id}>
                <tr
                  className={`transition-colors ${hasLog ? 'cursor-pointer hover:bg-white/5' : 'hover:bg-white/[0.02]'} ${isOpen ? 'bg-white/5' : ''}`}
                  onClick={hasLog ? () => setOpen(isOpen ? null : trade.id) : undefined}
                  title={hasLog ? 'Click to see the post-90′ timeline' : undefined}
                >
                  <td className="py-2.5 pr-4 text-zinc-400 whitespace-nowrap">
                    {hasLog && <span className="text-zinc-600 mr-1">{isOpen ? '▾' : '▸'}</span>}
                    {new Date(trade.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 pr-4 text-white">
                    {trade.home_team} v {trade.away_team}
                    <div className="text-zinc-600 text-[10px]">
                      {trade.added_minutes}min stoppage
                      {trade.bust_goals && trade.outcome !== 'WON' && (
                        <span className="text-rose-400/90" title="Goal(s) that busted the Under — clock + score"> · ⚽ {trade.bust_goals}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-sky-400">
                    {trade.market_type.replace('OVER_UNDER_', 'U/O ').replace(/(\d)(\d)$/, '$1.$2')}
                    {trade.home_goals != null && trade.away_goals != null && (
                      <span className="text-zinc-400" title="Score when the bet was placed"> ({trade.home_goals}-{trade.away_goals})</span>
                    )}
                    <div className="text-zinc-500">{trade.selection}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      trade.side === 'BACK' ? 'bg-sky-500/20 text-sky-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-white">{trade.requested_price.toFixed(2)}</td>
                  <td className="py-2.5 pr-4 text-zinc-300">£{trade.stake}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[10px] uppercase ${
                      trade.status === 'SETTLED' ? 'text-zinc-400'
                      : trade.status === 'PENDING' ? 'text-amber-400'
                      : 'text-zinc-500'
                    }`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {trade.outcome ? (
                      <span className={trade.outcome === 'WON' ? 'text-emerald-400' : 'text-rose-400'}>
                        {trade.outcome}
                      </span>
                    ) : '—'}
                  </td>
                  <td className={`py-2.5 pr-4 font-semibold ${pnlClass(trade.pnl)}`}>
                    {pnlDisplay(trade)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {trade.dry_run ? (
                      <span className="text-amber-500 text-[10px]">DRY</span>
                    ) : (
                      <span className="text-emerald-500 text-[10px]">LIVE</span>
                    )}
                  </td>
                </tr>
                {isOpen && hasLog && (
                  <tr className="bg-black/20">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                        Post-90′ timeline · {trade.home_team} v {trade.away_team}
                      </div>
                      <pre className="text-[11px] leading-relaxed text-zinc-300 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono border border-white/10 rounded-lg bg-black/30 p-3">
                        {trade.stoppage_log}
                      </pre>
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

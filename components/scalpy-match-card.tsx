'use client'

import { motion } from 'framer-motion'
import type { MatchState } from '@/types/scalpy'

interface Props {
  state: MatchState
  betEvent?: {
    side: 'BACK' | 'LAY'
    selection: string
    price: number
    stake: number
    marketType: string
    addedMinutes: number
    dryRun: boolean
  } | null
}

function goalCountToMarketLabel(totalGoals: number): string {
  const n = Math.min(totalGoals, 5)
  return `U/O ${n}.5`
}

function phaseLabel(phase: string | null): string {
  if (!phase) return '—'
  const map: Record<string, string> = {
    FirstHalf:  '1st Half',
    HalfTime:   'Half Time',
    SecondHalf: '2nd Half',
    FullTime:   'Full Time',
    ExtraTimeFirstHalf:  'ET 1st',
    ExtraTimeSecondHalf: 'ET 2nd',
  }
  return map[phase] ?? phase
}

export function ScalpyMatchCard({ state, betEvent }: Props) {
  const marketLabel = goalCountToMarketLabel(state.totalGoals)

  const statusBadge = (() => {
    if (state.phase === 'FullTime') return { label: 'FULL TIME', cls: 'bg-zinc-700 text-zinc-300' }
    if (!state.bettingDone) return { label: 'WATCHING', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' }
    if (betEvent) return { label: 'BET PLACED', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' }
    return { label: 'SKIPPED', cls: 'bg-zinc-600/40 text-zinc-400' }
  })()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-sm font-semibold text-white">
          {state.homeTeam} <span className="text-zinc-400">v</span> {state.awayTeam}
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
        <span>
          <span className="text-white font-semibold">{state.totalGoals}</span> goals
        </span>
        <span className="text-white/30">|</span>
        <span>Phase: <span className="text-zinc-200">{phaseLabel(state.phase)}</span></span>
        <span className="text-white/30">|</span>
        <span>Market: <span className="text-sky-400">{marketLabel}</span></span>
      </div>

      {/* Bet details (shown when bet placed) */}
      {betEvent && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-emerald-300">
              <span className={betEvent.side === 'BACK' ? 'text-sky-400' : 'text-rose-400'}>
                {betEvent.side}
              </span>
              {' '}{betEvent.selection} @ {betEvent.price.toFixed(2)}{' '}
              <span className="text-zinc-400">(£{betEvent.stake})</span>
              {' '}· {betEvent.addedMinutes}min stoppage
            </div>
            {betEvent.dryRun && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                DRY RUN
              </span>
            )}
          </div>
        </div>
      )}

      {/* Genius ID (debug) */}
      <div className="text-[10px] font-mono text-zinc-600">
        geniusId: {state.geniusId}
      </div>
    </motion.div>
  )
}

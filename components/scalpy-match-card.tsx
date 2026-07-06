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
  const n = Math.max(0, Math.floor(totalGoals))
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
    if (state.phase === 'FullTime') return { label: 'FULL TIME', cls: 'sc-pill-neutral', live: false }
    if (!state.bettingDone) return { label: 'WATCHING', cls: 'sc-pill-accent', live: true }
    if (betEvent) return { label: 'BET PLACED', cls: 'sc-pill-pos', live: false }
    return { label: 'SKIPPED', cls: 'sc-pill-neutral', live: false }
  })()

  const ribbon = state.phase === 'FullTime' ? 'sc-ribbon-idle'
    : !state.bettingDone ? 'sc-ribbon-accent'
    : betEvent ? 'sc-ribbon-pos'
    : 'sc-ribbon-idle'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="sc-card overflow-hidden p-4"
    >
      <span className={`sc-ribbon ${ribbon}`} />

      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-sm font-semibold text-zinc-100">
            {state.homeTeam} <span className="text-zinc-500">v</span> {state.awayTeam}
          </div>
          <span className={`sc-pill sc-pill-round shrink-0 ${statusBadge.cls}`}>
            {statusBadge.live && <span className="sc-live-dot" />}
            {statusBadge.label}
          </span>
        </div>

        {/* Score + clock */}
        <div className="flex items-baseline gap-3 font-mono">
          <span className="text-2xl sm:text-3xl sc-money text-zinc-50 leading-none tabular-nums">
            {state.homeGoals} <span className="text-zinc-500">–</span> {state.awayGoals}
          </span>
          {state.currentMinute && (
            <span className="text-sm font-semibold text-emerald-400 tabular-nums px-1.5 py-0.5 rounded bg-[var(--sc-pos-soft)]">
              {/^\d+$/.test(state.currentMinute) ? `${state.currentMinute}'` : state.currentMinute}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
          <span>Phase: <span className="text-zinc-200">{phaseLabel(state.phase)}</span></span>
          <span className="h-3 w-px bg-white/10" />
          <span>Market: <span className="text-sky-400">{marketLabel}</span></span>
        </div>

        {/* Bet details (shown when bet placed) */}
        {betEvent && (
          <div className="rounded-lg bg-[var(--sc-pos-soft)] border border-emerald-500/25 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-mono text-emerald-500">
                <span className={`sc-pill align-middle ${betEvent.side === 'BACK' ? 'sc-pill-accent' : 'sc-pill-neg'}`}>
                  {betEvent.side}
                </span>
                {' '}{betEvent.selection} @ {betEvent.price.toFixed(2)}{' '}
                <span className="text-zinc-400">(£{betEvent.stake})</span>
                {' '}· {betEvent.addedMinutes}min stoppage
              </div>
              {betEvent.dryRun && (
                <span className="sc-pill sc-pill-warn sc-pill-round shrink-0">DRY RUN</span>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

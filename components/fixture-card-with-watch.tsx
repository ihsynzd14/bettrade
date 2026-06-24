'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { MatchState } from '@/types/scalpy'

const ENGINE = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:4001'

function minuteLabel(m: string | null): string {
  if (!m) return '—'
  return /^\d+$/.test(m) ? `${m}'` : m
}

function price(p: number | null | undefined): string {
  return p == null ? '—' : p.toFixed(2)
}

export function FixtureCardWithWatch({ state }: { state: MatchState }) {
  const [busy, setBusy] = useState(false)
  const watching = state.watching !== false

  const setWatch = async (next: boolean) => {
    if (busy || next === watching) return
    setBusy(true)
    try {
      await fetch(`${ENGINE}/api/scalpy/watch/${state.geniusId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watching: next }),
      })
      // The SSE watch_toggled event reconciles the canonical state.
    } catch {
      /* ignore — optimistic, SSE will correct */
    }
    setBusy(false)
  }

  const ou = state.ouBook
  const marketLabel = ou ? `U/O ${ou.threshold}` : `U/O ${Math.max(0, state.totalGoals)}.5`
  const suspended = ou?.status && ou.status !== 'OPEN'

  const badge = state.betPlaced
    ? { label: 'BET PLACED', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' }
    : !watching
      ? { label: 'PAUSED', cls: 'bg-zinc-600/40 text-zinc-400 border border-zinc-500/30' }
      : state.pendingBet
        ? { label: `DEFERRED ${state.pendingBet.addedMinutes}′`, cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' }
        : state.bettingDone
          ? { label: 'DONE', cls: 'bg-zinc-600/40 text-zinc-400' }
          : { label: 'WATCHING', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-white/5 backdrop-blur-sm p-4 space-y-3 ${watching ? 'border-white/10' : 'border-white/5 opacity-70'}`}
    >
      {/* Header: teams + watch toggle + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-sm font-semibold text-white">
          {state.homeTeam} <span className="text-zinc-500">v</span> {state.awayTeam}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWatch(true)} disabled={busy} title="Watch"
              className={`text-sm leading-none ${watching ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-300'}`}
            >👁</button>
            <button
              onClick={() => setWatch(false)} disabled={busy} title="Stop watching"
              className={`text-xs leading-none ${!watching ? 'text-rose-400' : 'text-zinc-600 hover:text-rose-400'}`}
            >✕</button>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>

      {/* League */}
      <div className="text-[11px] font-mono text-zinc-500">{state.competition ?? 'Unknown league'}</div>

      {/* Score + minute + stoppage */}
      <div className="flex items-baseline gap-3 font-mono">
        <span className="text-xl font-bold text-white tabular-nums">
          {state.homeGoals} <span className="text-zinc-500">–</span> {state.awayGoals}
        </span>
        <span className="text-sm font-semibold text-emerald-400 tabular-nums">{minuteLabel(state.currentMinute)}</span>
        {state.estimatedStoppage != null && state.estimatedStoppage > 0 && (
          <span className="text-[11px] text-amber-400/80" title="Predicted added time (estimate)">est +{state.estimatedStoppage}′</span>
        )}
      </div>

      {/* Market + BBP / BLP / LTP */}
      <div className="rounded-lg bg-white/5 border border-white/5 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-sky-400">{marketLabel} <span className="text-zinc-600">UNDER</span></span>
          {suspended && <span className="text-[10px] font-mono text-rose-400">{ou?.status}</span>}
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center font-mono">
          <Quote label="BBP" value={price(ou?.bbp)} cls="text-sky-300" />
          <Quote label="BLP" value={price(ou?.blp)} cls="text-rose-300" />
          <Quote label="LTP" value={price(ou?.ltp)} cls="text-zinc-200" />
        </div>
      </div>
    </motion.div>
  )
}

function Quote({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div>
      <div className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  )
}

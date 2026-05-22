# Scalpy Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** `2026-05-22-scalpy-engine.md` must be completed first. This plan requires `/api/scalpy/stream`, `/api/scalpy/trades`, and `/api/scalpy/summary` to be running.

**Goal:** Build the `/scalpy` frontend dashboard — a live monitoring page that shows Scalpy's active match tracking and full trade history with P&L.

**Architecture:** Next.js App Router page at `/scalpy`. Live panel uses a custom SSE hook connecting to `bettrade-engine`'s `/api/scalpy/stream`. Trade history fetched server-side from `/api/scalpy/trades`. Components are client-side where real-time updates needed, server-side for initial data.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion

---

## File Map

### New files — bettrade

| File | Responsibility |
|---|---|
| `types/scalpy.ts` | TypeScript interfaces for match states, trades, SSE events |
| `hooks/useScalpyStream.ts` | SSE client hook — connects to bettrade-engine SSE stream |
| `components/scalpy-match-card.tsx` | Live card per tracked fixture |
| `components/scalpy-trades-table.tsx` | Trade history table with P&L |
| `components/scalpy-summary-bar.tsx` | Summary stats: total bets, win rate, P&L |
| `app/scalpy/page.tsx` | Page layout — live panel + trades panel |

---

## Task 13: TypeScript Types + SSE Hook

**Files:**
- Create: `bettrade/types/scalpy.ts`
- Create: `bettrade/hooks/useScalpyStream.ts`

- [ ] **Step 1: Create `types/scalpy.ts`**

```ts
// Match state as tracked by ScalpyEngine (in-memory)
export interface MatchState {
  geniusId: string
  homeTeam: string
  awayTeam: string
  betfairEventId: string
  betfairMarketId: string
  totalGoals: number
  phase: string | null
  bettingDone: boolean
  lastSeenTs: string | null
}

// A completed or pending trade row from Supabase
export interface ScalpyTrade {
  id: string
  bet_id: string | null
  dry_run: boolean
  genius_id: string
  betfair_event_id: string
  betfair_market_id: string
  selection_id: number
  home_team: string
  away_team: string
  total_goals: number
  added_minutes: number
  market_type: string        // e.g. "OVER_UNDER_25"
  selection: string          // "UNDER" | "OVER"
  side: 'BACK' | 'LAY'
  requested_price: number
  matched_price: number | null
  stake: number
  reason: string | null
  status: 'PENDING' | 'MATCHED' | 'SETTLED' | 'SKIPPED' | 'FAILED'
  outcome: 'WON' | 'LOST' | null
  pnl: number | null
  created_at: string
  settled_at: string | null
}

export interface ScalpySummary {
  total: number
  settled: number
  won: number
  lost: number
  winRate: number | null
  totalPnl: number
  todayPnl: number
}

// SSE event types emitted by bettrade-engine
export type ScalpySSEEvent =
  | { type: 'match_states'; data: MatchState[] }
  | { type: 'goal'; geniusId: string; data: { totalGoals: number } }
  | { type: 'phase_change'; geniusId: string; data: { phase: string } }
  | { type: 'full_time'; geniusId: string }
  | { type: 'bet_placed'; geniusId: string; data: BetPlacedData }
  | { type: 'bet_skipped'; geniusId: string; data: { reason: string; addedMinutes?: number } }
  | { type: 'trade_settled'; data: { tradeId: string; outcome: string; pnl: number; dryRun: boolean } }
  | { type: 'error'; geniusId: string; data: { message: string } }

export interface BetPlacedData {
  tradeId: string
  side: 'BACK' | 'LAY'
  selection: string
  price: number
  stake: number
  marketType: string
  addedMinutes: number
  dryRun: boolean
}
```

- [ ] **Step 2: Create `hooks/useScalpyStream.ts`**

```ts
'use client'

import { useEffect, useRef, useState } from 'react'
import type { MatchState, ScalpySSEEvent, BetPlacedData } from '@/types/scalpy'

interface ScalpyStreamState {
  matchStates: MatchState[]
  recentEvents: Array<{ ts: number; event: ScalpySSEEvent }>
  connected: boolean
}

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:4001'

export function useScalpyStream() {
  const [state, setState] = useState<ScalpyStreamState>({
    matchStates: [],
    recentEvents: [],
    connected: false,
  })

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource(`${ENGINE_URL}/api/scalpy/stream`)
    esRef.current = es

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true }))
    }

    es.onmessage = (e) => {
      try {
        const event: ScalpySSEEvent = JSON.parse(e.data)

        setState(prev => {
          let { matchStates } = prev

          if (event.type === 'match_states') {
            matchStates = event.data
          } else if (event.type === 'goal' || event.type === 'phase_change') {
            // Update individual match state
            matchStates = matchStates.map(s => {
              if (s.geniusId !== event.geniusId) return s
              if (event.type === 'goal') return { ...s, totalGoals: event.data.totalGoals }
              if (event.type === 'phase_change') return { ...s, phase: event.data.phase }
              return s
            })
          } else if (event.type === 'bet_placed') {
            matchStates = matchStates.map(s =>
              s.geniusId === event.geniusId ? { ...s, bettingDone: true } : s
            )
          }

          // Keep last 20 events for the event log
          const recentEvents = [
            { ts: Date.now(), event },
            ...prev.recentEvents,
          ].slice(0, 20)

          return { matchStates, recentEvents, connected: true }
        })
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false }))
      // EventSource auto-reconnects
    }

    return () => {
      es.close()
    }
  }, [])

  return state
}
```

- [ ] **Step 3: Add `NEXT_PUBLIC_ENGINE_URL` to bettrade environment**

Add to `bettrade/.env.local` (create if missing):
```env
NEXT_PUBLIC_ENGINE_URL=http://localhost:4001
```

- [ ] **Step 4: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade" add types/scalpy.ts hooks/useScalpyStream.ts .env.local
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade" commit -m "feat: add Scalpy types and SSE hook"
```

---

## Task 14: Live Match Card Component

**Files:**
- Create: `bettrade/components/scalpy-match-card.tsx`

- [ ] **Step 1: Create `components/scalpy-match-card.tsx`**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade" add components/scalpy-match-card.tsx
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade" commit -m "feat: add ScalpyMatchCard live tracking component"
```

---

## Task 15: Summary Bar + Trade History Table

**Files:**
- Create: `bettrade/components/scalpy-summary-bar.tsx`
- Create: `bettrade/components/scalpy-trades-table.tsx`

- [ ] **Step 1: Create `components/scalpy-summary-bar.tsx`**

```tsx
import type { ScalpySummary } from '@/types/scalpy'

interface Props {
  summary: ScalpySummary
}

export function ScalpySummaryBar({ summary }: Props) {
  const pnlColor = summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const todayColor = summary.todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Bets', value: String(summary.total) },
        {
          label: 'Win Rate',
          value: summary.winRate !== null ? `${summary.winRate}%` : '—',
        },
        {
          label: 'Total P&L',
          value: summary.totalPnl !== undefined
            ? `${summary.totalPnl >= 0 ? '+' : ''}£${summary.totalPnl.toFixed(2)}`
            : '—',
          valueClass: pnlColor,
        },
        {
          label: "Today's P&L",
          value: summary.todayPnl !== undefined
            ? `${summary.todayPnl >= 0 ? '+' : ''}£${summary.todayPnl.toFixed(2)}`
            : '—',
          valueClass: todayColor,
        },
      ].map(({ label, value, valueClass }) => (
        <div
          key={label}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-1"
        >
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">{label}</div>
          <div className={`text-xl font-mono font-bold ${valueClass ?? 'text-white'}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/scalpy-trades-table.tsx`**

```tsx
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
  if (trades.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-600 font-mono text-sm">
        No trades yet. Scalpy is watching...
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
          {trades.map(trade => (
            <tr key={trade.id} className="hover:bg-white/5 transition-colors">
              <td className="py-2.5 pr-4 text-zinc-400">
                {new Date(trade.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="py-2.5 pr-4 text-white">
                {trade.home_team} v {trade.away_team}
                <div className="text-zinc-600 text-[10px]">{trade.added_minutes}min stoppage</div>
              </td>
              <td className="py-2.5 pr-4 text-sky-400">
                {trade.market_type.replace('OVER_UNDER_', 'U/O ').replace(/(\d)(\d)$/, '$1.$2')}
                <div className="text-zinc-500">{trade.selection}</div>
              </td>
              <td className="py-2.5 pr-4">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  trade.side === 'BACK'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'bg-rose-500/20 text-rose-400'
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade" add components/scalpy-summary-bar.tsx components/scalpy-trades-table.tsx
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade" commit -m "feat: add ScalpySummaryBar and ScalpyTradesTable components"
```

---

## Task 16: /scalpy Page

**Files:**
- Create: `bettrade/app/scalpy/page.tsx`

- [ ] **Step 1: Create `app/scalpy/page.tsx`**

```tsx
import { Suspense } from 'react'
import { ScalpyLivePanel } from './live-panel'
import { ScalpySummaryBar } from '@/components/scalpy-summary-bar'
import { ScalpyTradesTable } from '@/components/scalpy-trades-table'
import type { ScalpySummary, ScalpyTrade } from '@/types/scalpy'

const ENGINE_URL = process.env.BETTRADE_ENGINE_URL ?? 'http://localhost:4001'

async function fetchTrades(): Promise<ScalpyTrade[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scalpy/trades?limit=100`, {
      next: { revalidate: 30 },
    })
    const json = await res.json()
    return json.trades ?? []
  } catch {
    return []
  }
}

async function fetchSummary(): Promise<ScalpySummary> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scalpy/summary`, {
      next: { revalidate: 30 },
    })
    const json = await res.json()
    return json.summary ?? { total: 0, settled: 0, won: 0, lost: 0, winRate: null, totalPnl: 0, todayPnl: 0 }
  } catch {
    return { total: 0, settled: 0, won: 0, lost: 0, winRate: null, totalPnl: 0, todayPnl: 0 }
  }
}

export default async function ScalpyPage() {
  const [trades, summary] = await Promise.all([fetchTrades(), fetchSummary()])

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-mono font-bold text-white">Scalpy</h1>
            <p className="text-sm text-zinc-500 font-mono mt-1">
              Betfair U/O Stoppage-Time Trading Bot
            </p>
          </div>
          <div className="text-xs font-mono text-zinc-600">
            {new Date().toLocaleString('en-GB')}
          </div>
        </div>

        {/* Summary stats */}
        <ScalpySummaryBar summary={summary} />

        {/* Live tracking panel (client component — SSE) */}
        <section>
          <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Live Tracking
          </h2>
          <Suspense fallback={<div className="text-zinc-600 font-mono text-sm">Connecting...</div>}>
            <ScalpyLivePanel />
          </Suspense>
        </section>

        {/* Trade history */}
        <section>
          <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Trade History
          </h2>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <ScalpyTradesTable trades={trades} />
          </div>
        </section>

      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create `app/scalpy/live-panel.tsx`** (Client component for SSE)

```tsx
'use client'

import { useScalpyStream } from '@/hooks/useScalpyStream'
import { ScalpyMatchCard } from '@/components/scalpy-match-card'
import type { BetPlacedData } from '@/types/scalpy'

export function ScalpyLivePanel() {
  const { matchStates, recentEvents, connected } = useScalpyStream()

  // Build a map of geniusId → most recent bet_placed event
  const betMap = new Map<string, BetPlacedData>()
  for (const { event } of recentEvents) {
    if (event.type === 'bet_placed') {
      if (!betMap.has(event.geniusId)) betMap.set(event.geniusId, event.data)
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'} animate-pulse`} />
        <span className="text-xs font-mono text-zinc-500">
          {connected ? 'Engine connected' : 'Connecting to engine...'}
        </span>
        {matchStates.length > 0 && (
          <span className="text-xs font-mono text-zinc-600">
            · {matchStates.length} fixture{matchStates.length !== 1 ? 's' : ''} tracked
          </span>
        )}
      </div>

      {/* Match cards */}
      {matchStates.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-zinc-600 font-mono text-sm">
            No live fixtures being tracked yet.
          </p>
          <p className="text-zinc-700 font-mono text-xs mt-1">
            Scalpy activates when matched fixtures go IN_PLAY.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matchStates.map(state => (
            <ScalpyMatchCard
              key={state.geniusId}
              state={state}
              betEvent={betMap.get(state.geniusId) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add `/scalpy` link to the nav**

Read `bettrade/components/nav.tsx` and add a Scalpy link alongside the existing navigation items:

```tsx
// In the nav links section, add:
<Link href="/scalpy" className="text-sm font-mono text-zinc-400 hover:text-white transition-colors">
  Scalpy
</Link>
```

- [ ] **Step 4: Start the frontend and verify**

```bash
cd "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade"
npm run dev
```

Navigate to `http://localhost:4000/scalpy`.

Expected:
- Page loads with "Scalpy" header, four summary stat boxes
- Live Tracking section shows "Engine connected" (green dot) if bettrade-engine is running
- If no live fixtures: "No live fixtures being tracked yet."
- Trade History table shows past trades (or empty state message)

- [ ] **Step 5: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade" add app/scalpy/page.tsx app/scalpy/live-panel.tsx components/nav.tsx
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade" commit -m "feat: add /scalpy dashboard page with live tracking and trade history"
```

---

## End-to-End Smoke Test

- [ ] **Full system test**

1. Start geniusBackend
2. Start bettrade-engine (with `SCALPY_DRY_RUN=true`)
3. Start bettrade frontend
4. Open `http://localhost:4000/scalpy`
5. Confirm engine connects (green dot)
6. If a live match is tracked: confirm match card appears with correct team names and phase
7. After a stoppage event fires: confirm card shows "BET PLACED" badge with DRY RUN label
8. Check Supabase `scalpy_trades` table for the saved record
9. After FullTime: confirm the card shows "FULL TIME" and the trade shows WON/LOST + P&L in the table

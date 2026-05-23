import { Suspense } from 'react'
import Nav from '@/components/nav'
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
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
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
    </>
  )
}

import Nav from '@/components/nav'
import { ScalpySummaryBar } from '@/components/scalpy-summary-bar'
import { ScalpyTradesTable } from '@/components/scalpy-trades-table'
import { DailyRollover } from '@/components/daily-rollover'
import type { ScalpySummary, ScalpyTrade } from '@/types/scalpy'

const ENGINE_URL = process.env.BETTRADE_ENGINE_URL ?? 'http://localhost:4001'

const EMPTY_SUMMARY: ScalpySummary = { total: 0, settled: 0, won: 0, lost: 0, winRate: null, totalPnl: 0, todayPnl: 0 }

async function fetchTodayTrades(): Promise<ScalpyTrade[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scalpy/trades/today`, { cache: 'no-store' })
    const json = await res.json()
    return json.trades ?? []
  } catch {
    return []
  }
}

async function fetchSummary(): Promise<ScalpySummary> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scalpy/summary`, { cache: 'no-store' })
    const json = await res.json()
    return json.summary ?? EMPTY_SUMMARY
  } catch {
    return EMPTY_SUMMARY
  }
}

export default async function ScalpyPage() {
  const [trades, summary] = await Promise.all([fetchTodayTrades(), fetchSummary()])

  return (
    <>
      <Nav />
      <DailyRollover />
      <main className="pt-14 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-mono font-bold text-white">Scalpy</h1>
              <p className="text-sm text-zinc-500 font-mono mt-1">Bets placed today · Betfair U/O stoppage-time bot</p>
            </div>
            <div className="text-xs font-mono text-zinc-600">{new Date().toLocaleString('en-GB')}</div>
          </div>

          <ScalpySummaryBar summary={summary} />

          <section>
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-3">Bets Today</h2>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <ScalpyTradesTable trades={trades} />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

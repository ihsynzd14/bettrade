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
      <main className="relative pt-14 min-h-screen">
        <div className="pointer-events-none fixed inset-0 bg-grid opacity-40" />
        <div className="pointer-events-none fixed inset-x-0 top-14 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-accent-glow),transparent)]" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2.5 text-2xl font-mono font-bold tracking-tight text-white">
                <span className="h-5 w-1 rounded-full" style={{ background: 'var(--sc-accent)' }} />Scalpy
              </h1>
              <p className="text-sm text-zinc-500 font-mono mt-1">Bets placed today · Betfair U/O stoppage-time bot</p>
            </div>
            <div className="text-[11px] font-mono text-zinc-500 tabular-nums px-2.5 py-1 rounded-md border border-white/10">{new Date().toLocaleString('en-GB')}</div>
          </div>

          <ScalpySummaryBar summary={summary} />

          <section>
            <h2 className="flex items-center gap-2 text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-[0.14em] mb-3">
              <span className="sc-live-dot text-sky-400" />Bets Today<span className="ml-3 h-px flex-1 bg-white/10" />
            </h2>
            <div className="sc-card p-1.5 sm:p-2">
              <ScalpyTradesTable trades={trades} />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

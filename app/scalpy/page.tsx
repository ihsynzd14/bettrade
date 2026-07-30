import Nav from '@/components/nav'
import { ScalpySummaryBar } from '@/components/scalpy-summary-bar'
import { ScalpyTradesTable } from '@/components/scalpy-trades-table'
import { DailyRollover } from '@/components/daily-rollover'
import type { ScalpySummary, ScalpyTrade } from '@/types/scalpy'

const ENGINE_URL = process.env.BETTRADE_ENGINE_URL ?? 'http://localhost:4001'

const EMPTY_SUMMARY: ScalpySummary = { total: 0, settled: 0, won: 0, lost: 0, winRate: null, totalPnl: 0, todayPnl: 0 }

function istanbulDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(iso))
}

function todayIstanbulDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

async function fetchAllTrades(): Promise<ScalpyTrade[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scalpy/trades?limit=2000`, { cache: 'no-store' })
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
  const [trades, summary] = await Promise.all([fetchAllTrades(), fetchSummary()])
  const today = todayIstanbulDay()
  const todayTrades = trades.filter((trade) => istanbulDay(trade.created_at) === today)

  return (
    <>
      <Nav />
      <DailyRollover />
      <main className="relative pt-14 min-h-screen">
        <div className="pointer-events-none fixed inset-0 bg-grid opacity-40" />
        <div aria-hidden className="pointer-events-none fixed -top-32 right-[-10%] w-[600px] h-[600px] rounded-full sc-glow-orb" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400 mb-3">Live Operations</p>
              <h1 className="font-sans font-bold text-3xl sm:text-4xl tracking-tight text-zinc-50">Scalpy</h1>
              <p className="font-sans text-sm text-zinc-400 mt-2">Bets placed today · Betfair U/O stoppage-time bot</p>
            </div>
            <div className="shrink-0 text-[11px] font-mono text-zinc-500 tabular-nums px-2.5 py-1 rounded-md border border-[var(--sc-hairline)]">{new Date().toLocaleString('en-GB')}</div>
          </div>

          <ScalpySummaryBar summary={summary} trades={trades} />

          <section className="sc-card overflow-hidden">
            <h2 className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--sc-hairline)]">
              <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.15em]">
                <span className="sc-live-dot text-sky-400" />Bets Today
              </span>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{todayTrades.length} bet{todayTrades.length !== 1 ? 's' : ''}</span>
            </h2>
            <div className="p-1.5 sm:p-2">
              <ScalpyTradesTable trades={todayTrades} />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

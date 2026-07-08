import Nav from '@/components/nav'
import { ResultsByDay } from '@/components/results-by-day'
import type { ScalpyTrade } from '@/types/scalpy'

const ENGINE_URL = process.env.BETTRADE_ENGINE_URL ?? 'http://localhost:4001'

async function fetchAllTrades(): Promise<ScalpyTrade[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/scalpy/trades?limit=2000`, { cache: 'no-store' })
    const json = await res.json()
    return json.trades ?? []
  } catch {
    return []
  }
}

export default async function ResultsPage() {
  const trades = await fetchAllTrades()

  return (
    <>
      <Nav />
      <main className="relative pt-14 min-h-screen">
        <div className="pointer-events-none fixed inset-0 bg-grid opacity-40" />
        <div aria-hidden className="pointer-events-none fixed -top-32 right-[-10%] w-[600px] h-[600px] rounded-full sc-glow-orb" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400 mb-3">Track Record</p>
            <h1 className="font-sans font-bold text-3xl sm:text-4xl tracking-tight text-zinc-50">Results</h1>
            <p className="font-sans text-sm text-zinc-400 mt-2">Day-by-day P&amp;L — click a day to see its bets</p>
          </div>
          <ResultsByDay trades={trades} />
        </div>
      </main>
    </>
  )
}

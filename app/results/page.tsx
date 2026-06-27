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
      <main className="pt-14 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-mono font-bold text-white">Results</h1>
            <p className="text-sm text-zinc-500 font-mono mt-1">Day-by-day P&amp;L — click a day to see its bets</p>
          </div>
          <ResultsByDay trades={trades} />
        </div>
      </main>
    </>
  )
}

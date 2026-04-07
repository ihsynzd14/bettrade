import Nav from '@/components/nav'
import FixturesTable from '@/components/fixtures-table'

interface RunnerPrice {
  price: number
  size: number
}

interface Runner {
  name: string
  selectionId: number
  sortPriority: number
  lastPriceTraded: number | null
  totalMatched: number
  back: RunnerPrice[]
  lay: RunnerPrice[]
}

interface Market {
  status: string
  inplay: boolean
  totalMatched: number
  competition: string | null
  runners: Runner[]
}

interface EnrichedFixture {
  matchId: string
  geniusId: string
  betfairEventId: string
  betfairMarketId: string
  homeTeam: string
  awayTeam: string
  startTime: string
  status: string
  similarityScore: number
  market: Market | null
}

interface EngineResponse {
  ok: boolean
  count: number
  lastUpdated: string | null
  fixtures: EnrichedFixture[]
}

async function getFixtures(): Promise<EngineResponse> {
  const engineUrl = process.env.BETTRADE_ENGINE_URL ?? 'http://localhost:4001'

  try {
    const res = await fetch(`${engineUrl}/api/v1/fixtures/overlap`, {
      next: { revalidate: 60 },
    })

    if (!res.ok) throw new Error(`Engine returned ${res.status}`)
    return res.json()
  } catch {
    return { ok: false, count: 0, lastUpdated: null, fixtures: [] }
  }
}

export default async function FixturesPage() {
  const data = await getFixtures()

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400 mb-3">
              Live Overlap
            </p>
            <div className="flex items-end justify-between flex-wrap gap-4">
              <h1 className="font-sans font-bold text-4xl tracking-tight text-zinc-50">
                Matched Fixtures
              </h1>
              <div className="flex items-center gap-3 text-xs font-mono">
                {data.ok ? (
                  <>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      ENGINE LIVE
                    </span>
                    <span className="text-zinc-600">
                      {data.count} fixtures
                    </span>
                    {data.lastUpdated && (
                      <span className="text-zinc-600">
                        updated {new Date(data.lastUpdated).toLocaleTimeString()}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-red-400">ENGINE OFFLINE</span>
                )}
              </div>
            </div>
          </div>

          <FixturesTable fixtures={data.fixtures} />
        </div>
      </main>
    </>
  )
}

import Nav from '@/components/nav'
import { LiveFixturesPanel } from './live-panel'

export default function LiveFixturesPage() {
  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen bg-zinc-950 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-mono font-bold">Live Fixtures</h1>
            <p className="text-sm text-zinc-500 font-mono mt-1">Matches Scalpy is tracking in real time</p>
          </div>
          <LiveFixturesPanel />
        </div>
      </main>
    </>
  )
}

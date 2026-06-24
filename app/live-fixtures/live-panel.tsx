'use client'

import { useScalpyStream } from '@/hooks/useScalpyStream'
import { FixtureCardWithWatch } from '@/components/fixture-card-with-watch'

export function LiveFixturesPanel() {
  const { matchStates, connected } = useScalpyStream()
  // Show only fixtures we're actually receiving Genius event data for. A null minute means no
  // timed events have arrived (feed not delivering) → we can't detect the stoppage announcement,
  // so we can't bet on it. Hide those. (The engine keeps polling; the card appears the moment a
  // timed event arrives, and once shown the minute never reverts to null so it won't flicker out.)
  const live = matchStates.filter(s => s.phase !== 'FullTime' && s.currentMinute != null)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'} animate-pulse`} />
        <span className="text-xs font-mono text-zinc-500">
          {connected ? 'Engine connected' : 'Connecting to engine...'}
        </span>
        {live.length > 0 && (
          <span className="text-xs font-mono text-zinc-600">· {live.length} live fixture{live.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {live.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-zinc-600 font-mono text-sm">No live fixtures being tracked yet.</p>
          <p className="text-zinc-700 font-mono text-xs mt-1">Scalpy activates when matched fixtures go in-play.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {live.map(s => <FixtureCardWithWatch key={s.geniusId} state={s} />)}
        </div>
      )}
    </div>
  )
}

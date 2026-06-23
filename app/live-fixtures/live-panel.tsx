'use client'

import { useScalpyStream } from '@/hooks/useScalpyStream'
import { FixtureCardWithWatch } from '@/components/fixture-card-with-watch'

export function LiveFixturesPanel() {
  const { matchStates, connected } = useScalpyStream()
  // Defensive: the engine removes FullTime matches, but hide any that slip through.
  const live = matchStates.filter(s => s.phase !== 'FullTime')

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

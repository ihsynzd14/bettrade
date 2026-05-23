'use client'

import { useScalpyStream } from '@/hooks/useScalpyStream'
import { ScalpyMatchCard } from '@/components/scalpy-match-card'
import type { BetPlacedData } from '@/types/scalpy'

export function ScalpyLivePanel() {
  const { matchStates, recentEvents, connected } = useScalpyStream()

  // Build a map of geniusId → most recent bet_placed event
  const betMap = new Map<string, BetPlacedData>()
  for (const { event } of recentEvents) {
    if (event.type === 'bet_placed') {
      if (!betMap.has(event.geniusId)) betMap.set(event.geniusId, event.data)
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'} animate-pulse`} />
        <span className="text-xs font-mono text-zinc-500">
          {connected ? 'Engine connected' : 'Connecting to engine...'}
        </span>
        {matchStates.length > 0 && (
          <span className="text-xs font-mono text-zinc-600">
            · {matchStates.length} fixture{matchStates.length !== 1 ? 's' : ''} tracked
          </span>
        )}
      </div>

      {/* Match cards */}
      {matchStates.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-zinc-600 font-mono text-sm">
            No live fixtures being tracked yet.
          </p>
          <p className="text-zinc-700 font-mono text-xs mt-1">
            Scalpy activates when matched fixtures go IN_PLAY.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matchStates.map(state => (
            <ScalpyMatchCard
              key={state.geniusId}
              state={state}
              betEvent={betMap.get(state.geniusId) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}

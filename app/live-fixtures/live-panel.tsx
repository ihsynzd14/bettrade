'use client'

import { useEffect, useState } from 'react'
import { useScalpyStream } from '@/hooks/useScalpyStream'
import { FixtureCardWithWatch } from '@/components/fixture-card-with-watch'

const ENGINE = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:4001'

export function LiveFixturesPanel() {
  const { matchStates, connected } = useScalpyStream()

  // Manual-arm mode: matches start disarmed until armed. Poll /control so the page tells the
  // operator why their cards look paused (and what to do — click the eye to arm).
  const [manualArm, setManualArm] = useState(false)
  useEffect(() => {
    let alive = true
    const poll = () =>
      fetch(`${ENGINE}/api/scalpy/control`)
        .then((r) => r.json())
        .then((d) => { if (alive && d?.ok) setManualArm(!!d.manualArm) })
        .catch(() => {})
    poll()
    const t = setInterval(poll, 10000)
    return () => { alive = false; clearInterval(t) }
  }, [])
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

      {manualArm && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs font-mono text-sky-300">
          <span className="font-bold uppercase tracking-wider">Manual-arm</span>
          <span className="text-sky-300/80">Matches start <span className="font-bold">disarmed</span> — click the eye on a match to arm it for betting.</span>
        </div>
      )}

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

'use client'

import { useState } from 'react'

interface OverlappedFixture {
  matchId: string
  geniusId: string
  betfairEventId: string
  betfairMarketId: string
  homeTeam: string
  awayTeam: string
  startTime: string
  status: string
  similarityScore: number
}

const STATUS_STYLES: Record<string, string> = {
  IN_PLAY:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  PREMATCH:  'text-sky-400    bg-sky-500/10     border-sky-500/30',
  UNKNOWN:   'text-zinc-500   bg-zinc-800/50    border-zinc-700',
}

function statusLabel(status: string): string {
  if (status === 'IN_PLAY') return 'LIVE'
  if (status === 'PREMATCH' || status === '0') return 'PREMATCH'
  return status
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function FixturesTable({ fixtures }: { fixtures: OverlappedFixture[] }) {
  const [filter, setFilter] = useState<'ALL' | 'IN_PLAY' | 'PREMATCH'>('ALL')

  const filtered = fixtures.filter(f => {
    if (filter === 'ALL') return true
    if (filter === 'IN_PLAY') return f.status === 'IN_PLAY'
    if (filter === 'PREMATCH') return f.status !== 'IN_PLAY'
    return true
  })

  if (fixtures.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
        <p className="font-mono text-sm text-zinc-500">
          No overlapped fixtures available. Engine may still be syncing.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['ALL', 'IN_PLAY', 'PREMATCH'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={[
              'px-4 py-1.5 rounded-md text-xs font-mono uppercase tracking-wide transition-colors cursor-pointer',
              filter === tab
                ? 'bg-sky-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-50',
            ].join(' ')}
          >
            {tab === 'IN_PLAY' ? 'Live' : tab === 'PREMATCH' ? 'Upcoming' : 'All'}
            {tab === 'ALL' && ` (${fixtures.length})`}
            {tab === 'IN_PLAY' && ` (${fixtures.filter(f => f.status === 'IN_PLAY').length})`}
            {tab === 'PREMATCH' && ` (${fixtures.filter(f => f.status !== 'IN_PLAY').length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wide text-zinc-500">Match</th>
              <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wide text-zinc-500">Kick-off</th>
              <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wide text-zinc-500">Status</th>
              <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wide text-zinc-500">Market ID</th>
              <th className="text-right px-4 py-3 font-mono text-xs uppercase tracking-wide text-zinc-500">Match Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((fixture, i) => (
              <tr
                key={fixture.matchId}
                className={[
                  'border-b border-zinc-800/60 last:border-0 transition-colors hover:bg-zinc-800/40',
                  i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/30',
                ].join(' ')}
              >
                <td className="px-4 py-3">
                  <span className="font-sans font-medium text-zinc-50">
                    {fixture.homeTeam}
                  </span>
                  <span className="mx-2 text-zinc-600 font-mono text-xs">vs</span>
                  <span className="font-sans font-medium text-zinc-50">
                    {fixture.awayTeam}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {formatTime(fixture.startTime)}
                </td>
                <td className="px-4 py-3">
                  <span className={[
                    'inline-flex px-2 py-0.5 rounded border text-[11px] font-mono font-semibold uppercase tracking-wide',
                    STATUS_STYLES[fixture.status] ?? STATUS_STYLES.UNKNOWN,
                  ].join(' ')}>
                    {statusLabel(fixture.status)}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {fixture.betfairMarketId}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <span className={fixture.similarityScore >= 0.85 ? 'text-emerald-400' : 'text-sky-400'}>
                    {(fixture.similarityScore * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

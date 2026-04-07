'use client'

import { useState } from 'react'

/* ── Types ────────────────────────────────────────────────── */

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

/* ── Helpers ──────────────────────────────────────────────── */

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatVolume(amount: number): string {
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)     return `£${(amount / 1_000).toFixed(0)}K`
  return `£${amount.toFixed(0)}`
}

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '-'
  return price.toFixed(2)
}

function formatSize(size: number): string {
  if (size >= 1_000) return `£${(size / 1_000).toFixed(1)}K`
  return `£${size.toFixed(0)}`
}

function isLive(fixture: EnrichedFixture): boolean {
  return fixture.status === 'IN_PLAY' || fixture.market?.inplay === true
}

/* ── Market Status Badge ─────────────────────────────────── */

const MARKET_STATUS_STYLES: Record<string, string> = {
  OPEN:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  SUSPENDED: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  CLOSED:    'text-zinc-500 bg-zinc-800/50 border-zinc-700',
}

/* ── Fixture Card ────────────────────────────────────────── */

function FixtureCard({ fixture }: { fixture: EnrichedFixture }) {
  const [expanded, setExpanded] = useState(false)
  const market = fixture.market
  const live = isLive(fixture)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden transition-colors hover:border-zinc-700">
      {/* Card header: status + competition + volume */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {live ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-mono font-semibold uppercase tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              LIVE
            </span>
          ) : (
            <span className="text-sky-400 text-[11px] font-mono font-semibold uppercase tracking-wide">
              PREMATCH
            </span>
          )}
          {market?.competition && (
            <span className="text-zinc-500 text-[11px] font-mono">
              {market.competition}
            </span>
          )}
        </div>
        {market && (
          <span className="text-zinc-500 text-[11px] font-mono">
            Vol: {formatVolume(market.totalMatched)}
          </span>
        )}
      </div>

      {/* Teams + time */}
      <div className="px-5 pb-3">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-sans font-semibold text-lg text-zinc-50">
            {fixture.homeTeam}
          </span>
          <span className="text-zinc-600 font-mono text-xs">vs</span>
          <span className="font-sans font-semibold text-lg text-zinc-50">
            {fixture.awayTeam}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
          <span>{formatTime(fixture.startTime)}</span>
          <span>·</span>
          <span className={fixture.similarityScore >= 0.85 ? 'text-emerald-400' : 'text-sky-400'}>
            Match: {(fixture.similarityScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Odds grid */}
      {market && market.runners.length > 0 ? (
        <div className="px-5 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {market.runners.map(runner => (
              <div key={runner.selectionId} className="rounded-lg border border-zinc-800 overflow-hidden">
                <div className="text-center py-1.5 border-b border-zinc-800">
                  <span className="text-[11px] font-mono font-medium text-zinc-400">
                    {runner.name}
                  </span>
                </div>
                <div className="grid grid-cols-2">
                  {/* Back */}
                  <div className="bg-sky-500/10 px-2 py-2 text-center border-r border-zinc-800">
                    <span className="block text-sky-300 font-mono text-sm font-bold">
                      {formatPrice(runner.back[0]?.price ?? null)}
                    </span>
                    <span className="block text-sky-400/60 font-mono text-[10px]">
                      {runner.back[0] ? formatSize(runner.back[0].size) : '-'}
                    </span>
                  </div>
                  {/* Lay */}
                  <div className="bg-rose-500/10 px-2 py-2 text-center">
                    <span className="block text-rose-300 font-mono text-sm font-bold">
                      {formatPrice(runner.lay[0]?.price ?? null)}
                    </span>
                    <span className="block text-rose-400/60 font-mono text-[10px]">
                      {runner.lay[0] ? formatSize(runner.lay[0].size) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 pb-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 py-3 text-center">
            <span className="text-zinc-600 text-xs font-mono">Market data unavailable</span>
          </div>
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-2.5 flex items-center justify-center gap-1.5 border-t border-zinc-800 hover:bg-zinc-800/40 transition-colors cursor-pointer"
      >
        <span className="text-zinc-500 text-[11px] font-mono">
          {expanded ? 'Less Details' : 'More Details'}
        </span>
        <svg
          className={`w-3 h-3 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-5 py-4 space-y-4">
          {/* Market info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-wide text-zinc-600 mb-0.5">Market Status</span>
              <span className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-mono font-semibold uppercase tracking-wide ${MARKET_STATUS_STYLES[market?.status ?? ''] ?? MARKET_STATUS_STYLES.CLOSED}`}>
                {market?.status ?? 'N/A'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-wide text-zinc-600 mb-0.5">Total Volume</span>
              <span className="text-sm font-mono text-zinc-300">{market ? formatVolume(market.totalMatched) : 'N/A'}</span>
            </div>
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-wide text-zinc-600 mb-0.5">Market ID</span>
              <span className="text-xs font-mono text-zinc-500">{fixture.betfairMarketId}</span>
            </div>
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-wide text-zinc-600 mb-0.5">Genius ID</span>
              <span className="text-xs font-mono text-zinc-500">{fixture.geniusId}</span>
            </div>
          </div>

          {/* Full runner breakdown */}
          {market && market.runners.length > 0 && (
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-wide text-zinc-600 mb-2">Runner Details</span>
              <div className="space-y-2">
                {market.runners.map(runner => (
                  <div key={runner.selectionId} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-semibold text-zinc-300">{runner.name}</span>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                        <span>LTP: {formatPrice(runner.lastPriceTraded)}</span>
                        <span>Matched: {formatVolume(runner.totalMatched)}</span>
                      </div>
                    </div>
                    {/* Full 3-deep ladder */}
                    <div className="grid grid-cols-2 gap-1">
                      {/* Back ladder */}
                      <div className="space-y-0.5">
                        <span className="block text-[9px] font-mono uppercase tracking-wide text-sky-500/60 mb-0.5">Back</span>
                        {runner.back.length > 0 ? runner.back.map((p, i) => (
                          <div key={i} className="flex items-center justify-between bg-sky-500/5 rounded px-2 py-1">
                            <span className="text-xs font-mono text-sky-300">{formatPrice(p.price)}</span>
                            <span className="text-[10px] font-mono text-sky-400/50">{formatSize(p.size)}</span>
                          </div>
                        )) : (
                          <div className="text-[10px] font-mono text-zinc-600 px-2">No back offers</div>
                        )}
                      </div>
                      {/* Lay ladder */}
                      <div className="space-y-0.5">
                        <span className="block text-[9px] font-mono uppercase tracking-wide text-rose-500/60 mb-0.5">Lay</span>
                        {runner.lay.length > 0 ? runner.lay.map((p, i) => (
                          <div key={i} className="flex items-center justify-between bg-rose-500/5 rounded px-2 py-1">
                            <span className="text-xs font-mono text-rose-300">{formatPrice(p.price)}</span>
                            <span className="text-[10px] font-mono text-rose-400/50">{formatSize(p.size)}</span>
                          </div>
                        )) : (
                          <div className="text-[10px] font-mono text-zinc-600 px-2">No lay offers</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IDs for debugging */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600 pt-2 border-t border-zinc-800/60">
            <span>Event: {fixture.betfairEventId}</span>
            <span>Match: {fixture.matchId}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Table Component ────────────────────────────────── */

export default function FixturesTable({ fixtures }: { fixtures: EnrichedFixture[] }) {
  const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'PREMATCH'>('ALL')

  const liveCount = fixtures.filter(isLive).length
  const prematchCount = fixtures.length - liveCount

  const filtered = fixtures.filter(f => {
    if (filter === 'ALL') return true
    if (filter === 'LIVE') return isLive(f)
    if (filter === 'PREMATCH') return !isLive(f)
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
        {(['ALL', 'LIVE', 'PREMATCH'] as const).map(tab => (
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
            {tab === 'LIVE' ? 'Live' : tab === 'PREMATCH' ? 'Upcoming' : 'All'}
            {' '}
            ({tab === 'ALL' ? fixtures.length : tab === 'LIVE' ? liveCount : prematchCount})
          </button>
        ))}
      </div>

      {/* Fixture cards */}
      <div className="space-y-3">
        {filtered.map(fixture => (
          <FixtureCard key={fixture.matchId} fixture={fixture} />
        ))}
      </div>
    </div>
  )
}

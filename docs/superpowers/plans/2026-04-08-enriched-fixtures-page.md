# Enriched Fixtures Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the overlapped fixtures with live Betfair exchange data (odds, volume, competition, market status) and display it in an enhanced fixtures page.

**Architecture:** The bettrade-engine fetches `listMarketBook` data during its polling cycle and merges it into the overlap cache. The frontend consumes the enriched data via the same endpoint and renders card-based fixture rows with inline odds grids and expandable detail panels.

**Tech Stack:** Node.js/Express (engine), Next.js 16 App Router + Tailwind v4 (frontend), Betfair Exchange REST API

---

## File Structure

### Backend (bettrade-engine)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/betfair-market.service.js` | **CREATE** | Fetch `listMarketBook` in batches, return parsed market data |
| `src/services/betfair-fixtures.service.js` | **MODIFY** | Add `COMPETITION` to projections, include competition + runner names in return data |
| `src/services/overlap.service.js` | **MODIFY** | Call market service after overlap match, merge market data into fixtures |

### Frontend (bettrade)

| File | Action | Responsibility |
|------|--------|----------------|
| `app/fixtures/page.tsx` | **MODIFY** | Update types to include `market` field |
| `components/fixtures-table.tsx` | **REWRITE** | Card layout with odds grid, expandable details, enhanced filters |

---

## Task 1: Create `betfair-market.service.js`

**Files:**
- Create: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine\src\services\betfair-market.service.js`

- [ ] **Step 1: Create the market service file**

Create `src/services/betfair-market.service.js` with the following content:

```javascript
import axios from 'axios'
import { getSessionToken } from './betfair-auth.service.js'

const BETTING_API = 'https://api.betfair.com/exchange/betting/rest/v1.0'
const BATCH_SIZE = 40 // ~5 weight points per market with EX_BEST_OFFERS → max 40 per 200-point request

/**
 * Fetches live market book data from Betfair for the given market IDs.
 * Batches requests to stay within the 200-point data limit.
 *
 * @param {string[]} marketIds - Array of Betfair market IDs
 * @returns {Promise<Map<string, object>>} Map of marketId → parsed market data
 */
export async function fetchMarketBooks(marketIds) {
  if (!marketIds.length) return new Map()

  const appKey = process.env.BETFAIR_APP_KEY
  const sessionToken = getSessionToken()

  const headers = {
    'X-Application':    appKey,
    'X-Authentication': sessionToken,
    'Content-Type':     'application/json',
    Accept:             'application/json',
    'Accept-Encoding':  'gzip, deflate',
    Connection:         'keep-alive',
  }

  const results = new Map()

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < marketIds.length; i += BATCH_SIZE) {
    const batch = marketIds.slice(i, i + BATCH_SIZE)

    try {
      const response = await axios.post(
        `${BETTING_API}/listMarketBook/`,
        {
          marketIds: batch,
          priceProjection: {
            priceData: ['EX_BEST_OFFERS', 'EX_TRADED_VOL'],
            exBestOffersOverrides: { bestPricesDepth: 3 },
          },
          matchProjection: 'ROLLED_UP_BY_PRICE',
        },
        { headers }
      )

      for (const book of response.data) {
        results.set(book.marketId, {
          status:       book.status,        // OPEN, SUSPENDED, CLOSED
          inplay:       book.inplay ?? false,
          totalMatched: book.totalMatched ?? 0,
          runners:      (book.runners ?? []).map(r => ({
            selectionId:     r.selectionId,
            lastPriceTraded: r.lastPriceTraded ?? null,
            totalMatched:    r.totalMatched ?? 0,
            back: (r.ex?.availableToBack ?? []).slice(0, 3).map(p => ({
              price: p.price,
              size:  p.size,
            })),
            lay: (r.ex?.availableToLay ?? []).slice(0, 3).map(p => ({
              price: p.price,
              size:  p.size,
            })),
          })),
        })
      }

      console.log(`[betfair-market] Fetched book for ${batch.length} markets (batch ${Math.floor(i / BATCH_SIZE) + 1})`)
    } catch (err) {
      console.error(`[betfair-market] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err.message)
      // Fixtures in this batch will get market: null (graceful degradation)
    }
  }

  return results
}
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `node -e "import('./src/services/betfair-market.service.js').then(() => console.log('OK'))"`

Working directory: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine`

Expected: `OK` (module loads without syntax errors)

- [ ] **Step 3: Commit**

```bash
git add src/services/betfair-market.service.js
git commit -m "feat(engine): add betfair-market service for listMarketBook batched fetching"
```

---

## Task 2: Modify `betfair-fixtures.service.js` to include competition and runner names

**Files:**
- Modify: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine\src\services\betfair-fixtures.service.js`

- [ ] **Step 1: Add COMPETITION to marketProjection and include runner/competition data in return**

Replace the entire content of `src/services/betfair-fixtures.service.js` with:

```javascript
import axios from 'axios'
import { getSessionToken } from './betfair-auth.service.js'

const BETTING_API = 'https://api.betfair.com/exchange/betting/rest/v1.0'

/**
 * Fetches upcoming and in-play Soccer Match Odds markets from Betfair.
 * Includes competition name and runner details for each market.
 *
 * @returns {Promise<Array<{
 *   betfairEventId: string,
 *   betfairMarketId: string,
 *   home: string,
 *   away: string,
 *   startTime: string,
 *   competition: string | null,
 *   runners: Array<{ selectionId: number, runnerName: string, sortPriority: number }>
 * }>>}
 */
export async function getBetfairFixtures() {
  const appKey = process.env.BETFAIR_APP_KEY
  const sessionToken = getSessionToken()

  const filter = {
    eventTypeIds: ['1'],           // 1 = Football/Soccer
    marketTypeCodes: ['MATCH_ODDS'],
    marketStartTime: {
      from: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      to:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  }

  const response = await axios.post(
    `${BETTING_API}/listMarketCatalogue/`,
    {
      filter,
      marketProjection: ['EVENT', 'RUNNER_DESCRIPTION', 'MARKET_START_TIME', 'COMPETITION'],
      maxResults: 1000,
      sort: 'FIRST_TO_START',
    },
    {
      headers: {
        'X-Application':   appKey,
        'X-Authentication': sessionToken,
        'Content-Type':    'application/json',
        Accept:            'application/json',
        'Accept-Encoding': 'gzip, deflate',
        Connection:        'keep-alive',
      },
    }
  )

  const markets = response.data

  return markets
    .filter(m => m.runners && m.runners.length >= 2)
    .map(m => {
      const eventName = m.event?.name ?? ''
      const parts = eventName.split(' v ')
      const home = parts[0]?.trim() || m.runners[0]?.runnerName || ''
      const away = parts[1]?.trim() || m.runners[2]?.runnerName || m.runners[1]?.runnerName || ''

      return {
        betfairEventId:  m.event?.id    ?? '',
        betfairMarketId: m.marketId,
        home,
        away,
        startTime:       m.marketStartTime ?? '',
        competition:     m.competition?.name ?? null,
        runners:         (m.runners ?? []).map(r => ({
          selectionId:  r.selectionId,
          runnerName:   r.runnerName,
          sortPriority: r.sortPriority ?? 0,
        })),
      }
    })
}
```

Key changes from original:
- Added `'COMPETITION'` to `marketProjection` array (line with `marketProjection`)
- Added `competition` field to return object (from `m.competition?.name`)
- Added `runners` array to return object (selectionId, runnerName, sortPriority)

- [ ] **Step 2: Verify the module loads**

Run: `node -e "import('./src/services/betfair-fixtures.service.js').then(() => console.log('OK'))"`

Working directory: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/services/betfair-fixtures.service.js
git commit -m "feat(engine): add competition and runner details to betfair fixtures service"
```

---

## Task 3: Modify `overlap.service.js` to enrich fixtures with market data

**Files:**
- Modify: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine\src\services\overlap.service.js`

- [ ] **Step 1: Rewrite overlap.service.js to include market enrichment**

Replace the entire content of `src/services/overlap.service.js` with:

```javascript
import { getBetfairFixtures } from './betfair-fixtures.service.js'
import { getGeniusFixtures }  from './genius-fixtures.service.js'
import { fetchMarketBooks }   from './betfair-market.service.js'
import { fixtureSimilarity }  from '../lib/normalize.js'

const SIMILARITY_THRESHOLD = 0.65
const TIME_WINDOW_MS = 60 * 60 * 1000 // ±1 hour

/** In-memory state — no external cache */
let overlappedFixtures = []
let lastUpdated = null
let isPolling = false

/**
 * Returns the current overlapped fixtures list.
 *
 * @returns {{ fixtures: object[], lastUpdated: string | null }}
 */
export function getOverlap() {
  return {
    fixtures: overlappedFixtures,
    lastUpdated,
  }
}

/**
 * Merges runner names from listMarketCatalogue with price data from listMarketBook.
 * Maps runners by selectionId so names line up with back/lay prices.
 *
 * @param {Array<{ selectionId: number, runnerName: string, sortPriority: number }>} catalogueRunners
 * @param {Array<{ selectionId: number, lastPriceTraded: number|null, totalMatched: number, back: object[], lay: object[] }>} bookRunners
 * @returns {Array<{ name: string, selectionId: number, sortPriority: number, lastPriceTraded: number|null, totalMatched: number, back: object[], lay: object[] }>}
 */
function mergeRunners(catalogueRunners, bookRunners) {
  const bookMap = new Map()
  for (const br of bookRunners) {
    bookMap.set(br.selectionId, br)
  }

  return catalogueRunners
    .sort((a, b) => a.sortPriority - b.sortPriority)
    .map(cr => {
      const br = bookMap.get(cr.selectionId)
      return {
        name:            cr.runnerName,
        selectionId:     cr.selectionId,
        sortPriority:    cr.sortPriority,
        lastPriceTraded: br?.lastPriceTraded ?? null,
        totalMatched:    br?.totalMatched ?? 0,
        back:            br?.back ?? [],
        lay:             br?.lay ?? [],
      }
    })
}

/**
 * Runs one sync cycle: fetch both sources, compute overlap, enrich with market data.
 */
export async function syncOnce() {
  console.log('[overlap] Sync started...')

  const [betfairFixtures, geniusFixtures] = await Promise.all([
    getBetfairFixtures(),
    getGeniusFixtures(),
  ])

  console.log(`[overlap] Betfair: ${betfairFixtures.length} markets | Genius: ${geniusFixtures.length} fixtures`)

  // Build a lookup from betfairMarketId → full betfair fixture (for competition + runners)
  const betfairLookup = new Map()
  for (const bf of betfairFixtures) {
    betfairLookup.set(bf.betfairMarketId, bf)
  }

  const matched = []

  for (const genius of geniusFixtures) {
    const geniusTime = new Date(genius.startTime).getTime()

    for (const betfair of betfairFixtures) {
      const betfairTime = new Date(betfair.startTime).getTime()

      if (Math.abs(geniusTime - betfairTime) > TIME_WINDOW_MS) continue

      const score = fixtureSimilarity(
        { home: genius.home, away: genius.away },
        { home: betfair.home, away: betfair.away }
      )

      if (score >= SIMILARITY_THRESHOLD) {
        matched.push({
          matchId:         `bf_${betfair.betfairEventId}_gs_${genius.geniusId}`,
          geniusId:        genius.geniusId,
          betfairEventId:  betfair.betfairEventId,
          betfairMarketId: betfair.betfairMarketId,
          homeTeam:        genius.home,
          awayTeam:        genius.away,
          startTime:       genius.startTime,
          status:          genius.status,
          similarityScore: Math.round(score * 100) / 100,
        })
        break
      }
    }
  }

  console.log(`[overlap] Matched ${matched.length} fixtures, fetching market books...`)

  // Enrich with live Betfair market data
  const marketIds = matched.map(f => f.betfairMarketId)
  let marketBooks = new Map()

  try {
    marketBooks = await fetchMarketBooks(marketIds)
  } catch (err) {
    console.error('[overlap] Market book enrichment failed:', err.message)
    // Graceful degradation: fixtures will have market: null
  }

  // Merge market data into each fixture
  const enriched = matched.map(fixture => {
    const book = marketBooks.get(fixture.betfairMarketId)
    const catalogue = betfairLookup.get(fixture.betfairMarketId)

    if (!book) {
      return { ...fixture, market: null }
    }

    return {
      ...fixture,
      market: {
        status:       book.status,
        inplay:       book.inplay,
        totalMatched: book.totalMatched,
        competition:  catalogue?.competition ?? null,
        runners:      mergeRunners(catalogue?.runners ?? [], book.runners),
      },
    }
  })

  overlappedFixtures = enriched
  lastUpdated = new Date().toISOString()

  console.log(`[overlap] Sync complete — ${enriched.length} overlapped fixtures`)
}

/**
 * Starts the background polling loop.
 * Runs syncOnce immediately, then every POLL_INTERVAL_MS.
 */
export function startPolling() {
  if (isPolling) return
  isPolling = true

  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS ?? '60000', 10)

  syncOnce().catch(err => console.error('[overlap] Initial sync failed:', err.message))

  setInterval(() => {
    syncOnce().catch(err => console.error('[overlap] Sync error:', err.message))
  }, intervalMs)

  console.log(`[overlap] Polling started (interval: ${intervalMs}ms)`)
}
```

Key changes from original:
- Import `fetchMarketBooks` from the new market service
- New `mergeRunners()` helper that joins catalogue runner names with book price data by `selectionId`
- Build `betfairLookup` map for accessing competition + runner data per market
- After overlap matching, call `fetchMarketBooks()` for all matched market IDs
- Merge market book + catalogue data into each fixture as a `market` field
- Graceful fallback: if enrichment fails, fixtures get `market: null`

- [ ] **Step 2: Verify the module loads**

Run: `node -e "import('./src/services/overlap.service.js').then(() => console.log('OK'))"`

Working directory: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/services/overlap.service.js
git commit -m "feat(engine): enrich overlapped fixtures with live Betfair market book data"
```

---

## Task 4: Test the engine end-to-end

**Files:** None (manual verification)

- [ ] **Step 1: Start the engine and verify enriched output**

Run: `npm run dev`

Working directory: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine`

Expected console output should show:
```
[engine] Starting bettrade-engine...
[betfair-auth] Logged in successfully
[overlap] Sync started...
[overlap] Betfair: ~100 markets | Genius: ~299 fixtures
[overlap] Matched ~86 fixtures, fetching market books...
[betfair-market] Fetched book for 40 markets (batch 1)
[betfair-market] Fetched book for 40 markets (batch 2)
[betfair-market] Fetched book for ~6 markets (batch 3)
[overlap] Sync complete — ~86 overlapped fixtures
```

- [ ] **Step 2: Verify the API response shape**

In a separate terminal, run:

```bash
curl -s http://localhost:4001/api/v1/fixtures/overlap | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('ok:',j.ok,'count:',j.count);const f=j.fixtures[0];console.log('first fixture keys:',Object.keys(f));if(f.market){console.log('market keys:',Object.keys(f.market));console.log('runners count:',f.market.runners.length);console.log('first runner:',JSON.stringify(f.market.runners[0],null,2))}else{console.log('market: null')}})"
```

Expected output should include:
```
ok: true count: ~86
first fixture keys: [ 'matchId', 'geniusId', 'betfairEventId', 'betfairMarketId', 'homeTeam', 'awayTeam', 'startTime', 'status', 'similarityScore', 'market' ]
market keys: [ 'status', 'inplay', 'totalMatched', 'competition', 'runners' ]
runners count: 3
first runner: {
  "name": "...",
  "selectionId": ...,
  "sortPriority": ...,
  "lastPriceTraded": ...,
  "totalMatched": ...,
  "back": [...],
  "lay": [...]
}
```

- [ ] **Step 3: Stop the engine** (Ctrl+C)

---

## Task 5: Update frontend types in `app/fixtures/page.tsx`

**Files:**
- Modify: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade\app\fixtures\page.tsx`

- [ ] **Step 1: Update types and pass enriched data to table**

Replace the entire content of `app/fixtures/page.tsx` with:

```tsx
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
```

Changes: Added `RunnerPrice`, `Runner`, `Market` interfaces. Changed `OverlappedFixture` to `EnrichedFixture` with `market: Market | null` field. Fetch logic and JSX are identical.

- [ ] **Step 2: Commit**

```bash
git add app/fixtures/page.tsx
git commit -m "feat(frontend): update fixtures page types for enriched market data"
```

---

## Task 6: Rewrite `fixtures-table.tsx` with card layout and odds grid

**Files:**
- Rewrite: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade\components\fixtures-table.tsx`

- [ ] **Step 1: Replace fixtures-table.tsx with the new card-based layout**

Replace the entire content of `components/fixtures-table.tsx` with:

```tsx
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
```

- [ ] **Step 2: Verify the frontend builds**

Run: `npm run build`

Working directory: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/fixtures-table.tsx
git commit -m "feat(frontend): rewrite fixtures table with card layout, odds grid, and expandable details"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Start the engine**

Run: `npm run dev`

Working directory: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine`

Wait for the first sync to complete (look for `[overlap] Sync complete`).

- [ ] **Step 2: Start the frontend**

In a separate terminal, run: `npm run dev`

Working directory: `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade`

- [ ] **Step 3: Verify in browser**

Open `http://localhost:4000/fixtures` in a browser. Verify:
- Cards show with competition name and volume in header
- LIVE/PREMATCH badges appear correctly
- Odds grid shows 3 runners (Home, Draw, Away) with back (blue) and lay (pink) prices
- Clicking "More Details" expands to show full 3-deep ladder, market status, runner matched amounts
- Filter tabs work: All, Live, Upcoming
- Fixtures with no market data show "Market data unavailable" placeholder

- [ ] **Step 4: Final commit (if any fixes needed)**

If any small fixes were needed during verification, commit them.

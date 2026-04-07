# Bettrade Engine + Fixtures Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `bettrade-engine` — a standalone Node.js microservice that authenticates with Betfair, fetches live football fixtures from both Betfair and geniusBackend, maps them using string-similarity, holds the overlap in memory, and exposes it via REST — then build a Fixtures page in the `bettrade` Next.js app that displays the live overlap.

**Architecture:** `bettrade-engine` runs as an independent Express process on port 4001. It starts a 60-second background polling loop on boot: fetching from geniusBackend's `/api/fixtures/sports/:sportId/active-fixtures` and from Betfair's `listMarketCatalogue` (Soccer, Match Odds), then running Dice Coefficient similarity matching. The result is stored in a module-level variable and served instantly via `GET /api/v1/fixtures/overlap`. The `bettrade` Next.js app adds a `/fixtures` route that fetches from the engine and renders the overlap table in the existing zinc + sky blue design system.

**Tech Stack:** Node.js 20, Express 4, axios, string-similarity, https (built-in), dotenv, cors — for the engine. Next.js 15, TypeScript, Tailwind v4 — for the frontend page.

---

## File Map

### bettrade-engine (new project at `bettrade-engine/`)

| File | Responsibility |
|------|----------------|
| `package.json` | Dependencies + scripts |
| `.env.example` | Documents required env vars (no secrets) |
| `src/index.js` | Entry point — starts Express + polling loop |
| `src/server.js` | Express app setup, routes mounted |
| `src/routes/fixtures.routes.js` | `GET /api/v1/fixtures/overlap` handler |
| `src/services/betfair-auth.service.js` | Session token management (cert login + keep-alive) |
| `src/services/betfair-fixtures.service.js` | Fetches Soccer Match Odds markets from Betfair REST API |
| `src/services/genius-fixtures.service.js` | Fetches active fixtures from geniusBackend REST API |
| `src/services/overlap.service.js` | Runs the matching algorithm, holds state in memory |
| `src/lib/normalize.js` | Pure string normalization + Dice Coefficient functions |

### bettrade (existing Next.js project)

| File | Responsibility |
|------|----------------|
| `app/fixtures/page.tsx` | New `/fixtures` route — server component, fetches from engine |
| `components/fixtures-table.tsx` | Client component — renders the overlap table with status badges |

---

## Task 1: Scaffold bettrade-engine

**Files:**
- Create: `bettrade-engine/package.json`
- Create: `bettrade-engine/.env.example`
- Create: `bettrade-engine/.gitignore`

- [ ] **Step 1: Create the project directory and `package.json`**

Create directory `bettrade-engine/` at `C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine\`.

Write `bettrade-engine/package.json`:
```json
{
  "name": "bettrade-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "axios": "^1.7.9",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "string-similarity": "^4.0.4"
  }
}
```

- [ ] **Step 2: Create `.env.example`**

Write `bettrade-engine/.env.example`:
```
# Betfair credentials
BETFAIR_APP_KEY=your_live_app_key_here
BETFAIR_USERNAME=your_betfair_username
BETFAIR_PASSWORD=your_betfair_password

# Paths to SSL cert files (non-interactive bot login)
BETFAIR_CERT_PATH=./certs/client-2048.crt
BETFAIR_KEY_PATH=./certs/client-2048.key

# geniusBackend base URL (running locally or on VPS)
GENIUS_BACKEND_URL=http://localhost:3002

# Genius Soccer sport ID (check /api/fixtures/sports to find it)
GENIUS_SOCCER_SPORT_ID=1

# Engine port
PORT=4001

# Polling interval in milliseconds (default: 60000 = 1 minute)
POLL_INTERVAL_MS=60000
```

- [ ] **Step 3: Create `.gitignore`**

Write `bettrade-engine/.gitignore`:
```
node_modules/
.env
certs/
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```
Expected: `added N packages` with no errors.

- [ ] **Step 5: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold bettrade-engine project"
```

---

## Task 2: String Normalization Library

**Files:**
- Create: `bettrade-engine/src/lib/normalize.js`

This is pure logic with no side effects — easiest to verify manually before wiring it in.

- [ ] **Step 1: Create `src/lib/normalize.js`**

```js
import stringSimilarity from 'string-similarity'

/**
 * Strips common football club name noise so "Man Utd" and "Manchester United"
 * become closer to each other before similarity scoring.
 *
 * @param {string} name
 * @returns {string} normalized lowercase string
 */
export function normalizeName(name) {
  return name
    .toLowerCase()
    // Remove common prefixes/suffixes
    .replace(/\b(fc|cf|ac|sc|afc|bfc|1\.|vfb|fsv|rb|bv|sv|vfl|tsv|1fc)\b/g, '')
    // Expand common abbreviations
    .replace(/\bman\b/g, 'manchester')
    .replace(/\butd\b/g, 'united')
    .replace(/\bspurs\b/g, 'tottenham')
    .replace(/\bwolves\b/g, 'wolverhampton')
    .replace(/\bvilla\b/g, 'aston villa')
    // Remove punctuation, extra spaces
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Dice Coefficient similarity between two strings, via string-similarity package.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1, where 1 is identical
 */
export function similarity(a, b) {
  return stringSimilarity.compareTwoStrings(normalizeName(a), normalizeName(b))
}

/**
 * Combined similarity score for a fixture pair.
 * Averages home-vs-home and away-vs-away scores.
 *
 * @param {{ home: string, away: string }} genius
 * @param {{ home: string, away: string }} betfair
 * @returns {number} 0–1 combined score
 */
export function fixtureSimilarity(genius, betfair) {
  const homeScore = similarity(genius.home, betfair.home)
  const awayScore = similarity(genius.away, betfair.away)
  return (homeScore + awayScore) / 2
}
```

- [ ] **Step 2: Manually verify normalization in Node REPL**

```bash
node --input-type=module << 'EOF'
import { normalizeName, similarity, fixtureSimilarity } from './src/lib/normalize.js'

console.log(normalizeName('Manchester United FC'))   // expected: 'manchester united'
console.log(normalizeName('Man Utd'))                 // expected: 'manchester united'
console.log(similarity('Man City', 'Manchester City')) // expected: > 0.6
console.log(fixtureSimilarity(
  { home: 'Man City', away: 'Arsenal FC' },
  { home: 'Manchester City', away: 'Arsenal' }
))  // expected: > 0.8
EOF
```

Adjust normalization rules if scores are too low.

- [ ] **Step 3: Commit**

```bash
git add src/lib/normalize.js
git commit -m "feat: add string normalization and similarity scoring"
```

---

## Task 3: Betfair Authentication Service

**Files:**
- Create: `bettrade-engine/src/services/betfair-auth.service.js`

This service manages one persistent Betfair session token. It logs in on startup using the SSL cert (non-interactive bot login) and refreshes via keep-alive every 4 hours to stay within the 12-hour session limit.

- [ ] **Step 1: Create `src/services/betfair-auth.service.js`**

```js
import https from 'https'
import fs from 'fs'
import axios from 'axios'

const LOGIN_URL = 'https://identitysso-cert.betfair.com/api/certlogin'
const KEEPALIVE_URL = 'https://identitysso.betfair.com/api/keepAlive'
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

let sessionToken = null
let keepAliveTimer = null

/**
 * Perform non-interactive (cert-based) bot login.
 * Sets the module-level sessionToken on success.
 */
export async function login() {
  const certPath = process.env.BETFAIR_CERT_PATH
  const keyPath  = process.env.BETFAIR_KEY_PATH
  const appKey   = process.env.BETFAIR_APP_KEY
  const username = process.env.BETFAIR_USERNAME
  const password = process.env.BETFAIR_PASSWORD

  if (!certPath || !keyPath || !appKey || !username || !password) {
    throw new Error('Missing Betfair env vars: BETFAIR_CERT_PATH, BETFAIR_KEY_PATH, BETFAIR_APP_KEY, BETFAIR_USERNAME, BETFAIR_PASSWORD')
  }

  const httpsAgent = new https.Agent({
    cert: fs.readFileSync(certPath),
    key:  fs.readFileSync(keyPath),
  })

  const params = new URLSearchParams({ username, password })

  const response = await axios.post(LOGIN_URL, params.toString(), {
    httpsAgent,
    headers: {
      'X-Application': appKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (response.data.loginStatus !== 'SUCCESS') {
    throw new Error(`Betfair login failed: ${response.data.loginStatus}`)
  }

  sessionToken = response.data.sessionToken
  console.log('[betfair-auth] Logged in successfully')

  // Start keep-alive loop
  if (keepAliveTimer) clearInterval(keepAliveTimer)
  keepAliveTimer = setInterval(keepAlive, KEEPALIVE_INTERVAL_MS)
}

/**
 * Returns the current session token.
 * Throws if not yet authenticated.
 */
export function getSessionToken() {
  if (!sessionToken) throw new Error('Betfair session not initialized. Call login() first.')
  return sessionToken
}

/**
 * Calls Betfair keep-alive to extend the session.
 * On failure, re-authenticates from scratch.
 */
async function keepAlive() {
  try {
    const response = await axios.get(KEEPALIVE_URL, {
      headers: {
        'X-Application': process.env.BETFAIR_APP_KEY,
        'X-Authentication': sessionToken,
        Accept: 'application/json',
      },
    })

    if (response.data.status === 'SUCCESS') {
      sessionToken = response.data.token
      console.log('[betfair-auth] Session refreshed via keep-alive')
    } else {
      console.warn('[betfair-auth] Keep-alive failed, re-logging in...')
      await login()
    }
  } catch (err) {
    console.error('[betfair-auth] Keep-alive error, re-logging in:', err.message)
    await login()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/betfair-auth.service.js
git commit -m "feat: add betfair cert-based auth service with keep-alive"
```

---

## Task 4: Betfair Fixtures Service

**Files:**
- Create: `bettrade-engine/src/services/betfair-fixtures.service.js`

Fetches all Soccer / Match Odds markets from Betfair REST API. Uses `listMarketCatalogue` with `eventTypeId: "1"` (Football) and `marketType: "MATCH_ODDS"`. Returns a flat array of `{ betfairEventId, betfairMarketId, home, away, startTime }`.

- [ ] **Step 1: Create `src/services/betfair-fixtures.service.js`**

```js
import axios from 'axios'
import { getSessionToken } from './betfair-auth.service.js'

const BETTING_API = 'https://api.betfair.com/exchange/betting/rest/v1.0'

/**
 * Fetches upcoming and in-play Soccer Match Odds markets from Betfair.
 *
 * @returns {Promise<Array<{
 *   betfairEventId: string,
 *   betfairMarketId: string,
 *   home: string,
 *   away: string,
 *   startTime: string
 * }>>}
 */
export async function getBetfairFixtures() {
  const appKey = process.env.BETFAIR_APP_KEY
  const sessionToken = getSessionToken()

  const filter = {
    eventTypeIds: ['1'],           // 1 = Football/Soccer
    marketTypeCodes: ['MATCH_ODDS'],
    inPlayOnly: false,
    turnInPlayEnabled: true,
    marketStartTime: {
      // Fetch matches starting within the next 24 hours + already in-play
      from: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      to:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  }

  const response = await axios.post(
    `${BETTING_API}/listMarketCatalogue/`,
    {
      filter,
      marketProjection: ['EVENT', 'RUNNER_DESCRIPTION', 'MARKET_START_TIME'],
      maxResults: 200,
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
    .filter(m => m.runners && m.runners.length === 2)
    .map(m => {
      // Betfair runner names are typically "Team A v Team B" — split on "v"
      // Or use runner descriptions directly
      const runnerNames = m.runners.map(r => r.runnerName)
      return {
        betfairEventId:  m.event?.id    ?? '',
        betfairMarketId: m.marketId,
        home:            runnerNames[0] ?? m.event?.name?.split(' v ')[0] ?? '',
        away:            runnerNames[1] ?? m.event?.name?.split(' v ')[1] ?? '',
        startTime:       m.marketStartTime ?? '',
      }
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/betfair-fixtures.service.js
git commit -m "feat: add betfair fixtures fetcher (listMarketCatalogue)"
```

---

## Task 5: Genius Fixtures Service

**Files:**
- Create: `bettrade-engine/src/services/genius-fixtures.service.js`

Calls geniusBackend's `GET /api/fixtures/sports/:sportId/active-fixtures` endpoint and normalizes the response into the same flat shape as Betfair fixtures.

- [ ] **Step 1: Inspect geniusBackend fixture shape**

Start geniusBackend and hit the endpoint to see the real response shape:
```bash
curl http://localhost:3002/api/fixtures/sports/1/active-fixtures
```

Note the actual field names for: home team name, away team name, start time, fixture ID.
The service below assumes standard Genius structure — adjust field paths if needed.

- [ ] **Step 2: Create `src/services/genius-fixtures.service.js`**

```js
import axios from 'axios'

/**
 * Fetches active football fixtures from the geniusBackend.
 *
 * @returns {Promise<Array<{
 *   geniusId: string,
 *   home: string,
 *   away: string,
 *   startTime: string,
 *   status: string
 * }>>}
 */
export async function getGeniusFixtures() {
  const baseUrl    = process.env.GENIUS_BACKEND_URL ?? 'http://localhost:3002'
  const sportId    = process.env.GENIUS_SOCCER_SPORT_ID ?? '1'

  const response = await axios.get(
    `${baseUrl}/api/fixtures/sports/${sportId}/active-fixtures`
  )

  const fixtures = response.data

  // Genius Fixture API structure (adjust field paths to match actual response):
  // fixture.id
  // fixture.competitors[0].name  (home)
  // fixture.competitors[1].name  (away)
  // fixture.startDatetime or fixture.fixture.startDatetime
  // fixture.statusId or fixture.fixture.status

  return fixtures.map(fixture => ({
    geniusId:  String(fixture.id),
    home:      fixture.competitors?.[0]?.name ?? '',
    away:      fixture.competitors?.[1]?.name ?? '',
    startTime: fixture.startDatetime ?? fixture.fixture?.startDatetime ?? '',
    status:    fixture.statusId      ?? fixture.fixture?.status        ?? 'UNKNOWN',
  }))
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/genius-fixtures.service.js
git commit -m "feat: add genius backend fixtures fetcher"
```

---

## Task 6: Overlap Service (Core Matching Logic)

**Files:**
- Create: `bettrade-engine/src/services/overlap.service.js`

This is the heart of the engine. It:
1. Fetches from both services
2. Filters to matches within ±1 hour of each other
3. Runs `fixtureSimilarity` on each pair
4. Keeps pairs scoring > 0.65 (adjustable)
5. Stores result in module-level `let overlappedFixtures`
6. Exports `getOverlap()` and `startPolling()`

- [ ] **Step 1: Create `src/services/overlap.service.js`**

```js
import { getBetfairFixtures } from './betfair-fixtures.service.js'
import { getGeniusFixtures }  from './genius-fixtures.service.js'
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
 * @returns {{ fixtures: OverlappedFixture[], lastUpdated: string | null }}
 */
export function getOverlap() {
  return {
    fixtures: overlappedFixtures,
    lastUpdated,
  }
}

/**
 * Runs one sync cycle: fetch both sources, compute overlap, update state.
 */
export async function syncOnce() {
  console.log('[overlap] Sync started...')

  const [betfairFixtures, geniusFixtures] = await Promise.all([
    getBetfairFixtures(),
    getGeniusFixtures(),
  ])

  console.log(`[overlap] Betfair: ${betfairFixtures.length} markets | Genius: ${geniusFixtures.length} fixtures`)

  const matched = []

  for (const genius of geniusFixtures) {
    const geniusTime = new Date(genius.startTime).getTime()

    for (const betfair of betfairFixtures) {
      const betfairTime = new Date(betfair.startTime).getTime()

      // Time filter: only compare fixtures within ±1 hour of each other
      if (Math.abs(geniusTime - betfairTime) > TIME_WINDOW_MS) continue

      const score = fixtureSimilarity(
        { home: genius.home, away: genius.away },
        { home: betfair.home, away: betfair.away }
      )

      if (score >= SIMILARITY_THRESHOLD) {
        matched.push({
          matchId:        `bf_${betfair.betfairEventId}_gs_${genius.geniusId}`,
          geniusId:       genius.geniusId,
          betfairEventId: betfair.betfairEventId,
          betfairMarketId: betfair.betfairMarketId,
          homeTeam:       genius.home,
          awayTeam:       genius.away,
          startTime:      genius.startTime,
          status:         genius.status,
          similarityScore: Math.round(score * 100) / 100,
        })
        break // each genius fixture matches at most one betfair market
      }
    }
  }

  overlappedFixtures = matched
  lastUpdated = new Date().toISOString()

  console.log(`[overlap] Sync complete — ${matched.length} overlapped fixtures`)
}

/**
 * Starts the background polling loop.
 * Runs syncOnce immediately, then every POLL_INTERVAL_MS.
 */
export function startPolling() {
  if (isPolling) return
  isPolling = true

  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS ?? '60000', 10)

  // Run immediately on startup
  syncOnce().catch(err => console.error('[overlap] Initial sync failed:', err.message))

  // Then on interval
  setInterval(() => {
    syncOnce().catch(err => console.error('[overlap] Sync error:', err.message))
  }, intervalMs)

  console.log(`[overlap] Polling started (interval: ${intervalMs}ms)`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/overlap.service.js
git commit -m "feat: add overlap matching service with in-memory state"
```

---

## Task 7: Express Server + Route

**Files:**
- Create: `bettrade-engine/src/routes/fixtures.routes.js`
- Create: `bettrade-engine/src/server.js`
- Create: `bettrade-engine/src/index.js`

- [ ] **Step 1: Create `src/routes/fixtures.routes.js`**

```js
import { Router } from 'express'
import { getOverlap } from '../services/overlap.service.js'

const router = Router()

/**
 * GET /api/v1/fixtures/overlap
 * Returns the in-memory overlap list instantly.
 */
router.get('/overlap', (req, res) => {
  const data = getOverlap()
  res.json({
    ok: true,
    count: data.fixtures.length,
    lastUpdated: data.lastUpdated,
    fixtures: data.fixtures,
  })
})

export { router as fixturesRoutes }
```

- [ ] **Step 2: Create `src/server.js`**

```js
import express from 'express'
import cors from 'cors'
import { fixturesRoutes } from './routes/fixtures.routes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'bettrade-engine', ts: new Date().toISOString() })
})

app.use('/api/v1/fixtures', fixturesRoutes)

export { app }
```

- [ ] **Step 3: Create `src/index.js`**

```js
import 'dotenv/config'
import { login } from './services/betfair-auth.service.js'
import { startPolling } from './services/overlap.service.js'
import { app } from './server.js'

const PORT = process.env.PORT ?? 4001

async function main() {
  console.log('[engine] Starting bettrade-engine...')

  // Authenticate with Betfair before polling starts
  await login()

  // Start 60-second overlap sync loop
  startPolling()

  app.listen(PORT, () => {
    console.log(`[engine] Listening on http://localhost:${PORT}`)
    console.log(`[engine] Overlap endpoint: http://localhost:${PORT}/api/v1/fixtures/overlap`)
  })
}

main().catch(err => {
  console.error('[engine] Fatal startup error:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Create a `.env` file with real credentials**

Copy `.env.example` to `.env` and fill in:
```
BETFAIR_APP_KEY=<your live app key>
BETFAIR_USERNAME=<betfair username>
BETFAIR_PASSWORD=<betfair password>
BETFAIR_CERT_PATH=./certs/client-2048.crt
BETFAIR_KEY_PATH=./certs/client-2048.key
GENIUS_BACKEND_URL=http://localhost:3002
GENIUS_SOCCER_SPORT_ID=1
PORT=4001
POLL_INTERVAL_MS=60000
```

Place your SSL cert files in `bettrade-engine/certs/` (the `.gitignore` excludes this directory).

- [ ] **Step 5: Start the engine and verify**

Make sure geniusBackend is running on port 3002, then:
```bash
npm run dev
```

Expected output:
```
[engine] Starting bettrade-engine...
[betfair-auth] Logged in successfully
[overlap] Polling started (interval: 60000ms)
[engine] Listening on http://localhost:4001
[overlap] Sync started...
[overlap] Betfair: N markets | Genius: N fixtures
[overlap] Sync complete — N overlapped fixtures
```

- [ ] **Step 6: Hit the endpoint**

```bash
curl http://localhost:4001/api/v1/fixtures/overlap | npx prettier --parser json
```

Expected:
```json
{
  "ok": true,
  "count": 12,
  "lastUpdated": "2026-04-02T...",
  "fixtures": [
    {
      "matchId": "bf_123_gs_456",
      "geniusId": "456",
      "betfairEventId": "123",
      "betfairMarketId": "1.123456",
      "homeTeam": "Manchester City",
      "awayTeam": "Arsenal",
      "startTime": "2026-04-02T15:00:00Z",
      "status": "IN_PLAY",
      "similarityScore": 0.92
    }
  ]
}
```

If `count` is 0 but both sources returned fixtures, the similarity threshold may need lowering. Edit `SIMILARITY_THRESHOLD` in `overlap.service.js` temporarily to `0.5` and observe scores in debug output.

- [ ] **Step 7: Commit**

```bash
git add src/routes/fixtures.routes.js src/server.js src/index.js
git commit -m "feat: add express server, fixtures route, and startup entry point"
```

---

## Task 8: Fixtures Page — Next.js Route

**Files:**
- Create: `bettrade/app/fixtures/page.tsx`
- Create: `bettrade/components/fixtures-table.tsx`

This adds a new `/fixtures` page to the existing `bettrade` Next.js app. The page is a server component that fetches from the engine. The table is a client component for interactive filtering.

- [ ] **Step 1: Create `bettrade/app/fixtures/page.tsx`**

```tsx
import Nav from '@/components/nav'
import FixturesTable from '@/components/fixtures-table'

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

interface EngineResponse {
  ok: boolean
  count: number
  lastUpdated: string | null
  fixtures: OverlappedFixture[]
}

async function getFixtures(): Promise<EngineResponse> {
  const engineUrl = process.env.BETTRADE_ENGINE_URL ?? 'http://localhost:4001'

  try {
    const res = await fetch(`${engineUrl}/api/v1/fixtures/overlap`, {
      // Revalidate every 60 seconds (matches engine polling interval)
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

- [ ] **Step 2: Add `BETTRADE_ENGINE_URL` to `bettrade/.env.local`**

Create `bettrade/.env.local`:
```
BETTRADE_ENGINE_URL=http://localhost:4001
```

- [ ] **Step 3: Create `bettrade/components/fixtures-table.tsx`**

```tsx
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
```

- [ ] **Step 4: Add nav link to fixtures page in `components/nav.tsx`**

Update `bettrade/components/nav.tsx` to add a Fixtures link:

```tsx
export default function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 backdrop-blur-md bg-zinc-950/80">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/" className="font-sans font-semibold text-lg tracking-tight text-zinc-50">
            Bettrade
          </a>
          <a
            href="/fixtures"
            className="font-mono text-xs uppercase tracking-wide text-zinc-400 hover:text-zinc-50 transition-colors"
          >
            Fixtures
          </a>
        </div>
        <button className="px-4 py-1.5 text-sm font-medium rounded-md bg-sky-500 hover:bg-sky-400 text-white transition-colors cursor-pointer">
          Request Access
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Build to verify no TypeScript errors**

```bash
npm run build
```
Expected: `✓ Compiled successfully` with no errors.

- [ ] **Step 6: Commit**

```bash
git add app/fixtures/page.tsx components/fixtures-table.tsx components/nav.tsx .env.local
git commit -m "feat: add fixtures page with overlap table from bettrade-engine"
```

---

## Self-Review Against Spec

| Spec requirement | Task |
|---|---|
| New standalone Node.js/Express microservice | Task 1 |
| Betfair non-interactive (cert) bot login | Task 3 |
| Session keep-alive every 4 hours | Task 3 |
| Betfair `listMarketCatalogue` — Soccer, Match Odds | Task 4 |
| geniusBackend `active-fixtures` fetch | Task 5 |
| ±1 hour time window filter | Task 6 |
| String normalization (expand abbreviations) | Task 2 |
| Dice Coefficient similarity scoring | Task 2 |
| 0.65 threshold for match | Task 6 |
| In-memory state, no external cache | Task 6 |
| 60-second polling loop | Task 6, 7 |
| `GET /api/v1/fixtures/overlap` endpoint | Task 7 |
| Output shape matches spec | Task 7 |
| `/fixtures` Next.js page | Task 8 |
| Fixtures table with status badges, filter tabs | Task 8 |
| Engine offline graceful handling | Task 8 |
| Nav link to Fixtures page | Task 8 |
| Port 4001 for engine | Task 1, 7 |

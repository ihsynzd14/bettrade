# Scalpy Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ScalpyEngine — a Betfair U/O stoppage-time trading bot that detects 90th-minute stoppage announcements from Genius Sports, places configurable BACK/LAY orders on the correct Under/Over market, and persists trade history to Supabase.

**Architecture:** ScalpyEngine lives in `bettrade-engine`, polls `geniusBackend`'s feed HTTP API every 3s per live fixture, maintains in-memory match state, runs a config-driven algorithm on `stoppageTimeAnnouncements` events, and places Betfair limit orders (or simulates them in DRY_RUN mode).

**Tech Stack:** Node.js ESM, Express, Betfair REST API, Supabase (`@supabase/supabase-js`), geniusBackend HTTP feed API

**Repos touched:**
- `bettrade-engine/` — all new Scalpy modules
- `geniusBackend/` — one new endpoint (Task 2)

---

## File Map

### New files — bettrade-engine

| File | Responsibility |
|---|---|
| `src/lib/supabase.js` | Supabase client singleton |
| `src/repositories/trade.repository.js` | Supabase CRUD for scalpy_trades + scalpy_match_states |
| `src/services/betfair-ou-market.service.js` | Fetch U/O market catalogue + book for a given eventId |
| `src/services/betfair-orders.service.js` | Betfair placeOrders wrapper with DRY_RUN mode |
| `src/scalpy/scalpy.algorithm.js` | Decision engine: addedMinutes + prices → BACK/LAY/SKIP |
| `src/scalpy/scalpy.match-state.js` | In-memory match state store (score, phase, bettingDone) |
| `src/scalpy/scalpy.engine.js` | Polling loop, event processing, trigger orchestrator |
| `src/scalpy/scalpy.settlement.js` | Post-match outcome + P&L calculation |
| `src/scalpy/scalpy.sse.js` | SSE broadcaster for frontend |
| `src/routes/scalpy.routes.js` | Express routes: /stream, /trades, /summary, /config |
| `scalpy-config.json` | User-editable algorithm rules (in bettrade-engine root) |

### Modified files — bettrade-engine

| File | Change |
|---|---|
| `src/index.js` | Import + start ScalpyEngine after Betfair login |
| `src/server.js` | Mount scalpy routes |
| `.env` | Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCALPY_DRY_RUN |
| `.env.example` | Same additions documented |
| `package.json` | Add `@supabase/supabase-js` |

### New files — geniusBackend

| File | Change |
|---|---|
| `src/routes/feed.routes.js` | Add `GET /:id/events` route |
| `src/services/feed/events.service.js` | Extract + filter events from Ably buffer |

---

## Task 1: Supabase Tables

**Files:**
- Supabase SQL editor (run directly in Supabase dashboard)

- [ ] **Step 1: Run migration SQL in Supabase dashboard**

Open your Supabase project → SQL Editor → New query → paste and run:

```sql
-- Trade history
CREATE TABLE IF NOT EXISTS scalpy_trades (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id             TEXT,
  dry_run            BOOLEAN NOT NULL DEFAULT true,
  genius_id          TEXT NOT NULL,
  betfair_event_id   TEXT NOT NULL,
  betfair_market_id  TEXT NOT NULL,
  selection_id       BIGINT NOT NULL,
  home_team          TEXT NOT NULL,
  away_team          TEXT NOT NULL,
  total_goals        INTEGER NOT NULL DEFAULT 0,
  added_minutes      INTEGER NOT NULL,
  market_type        TEXT NOT NULL,
  selection          TEXT NOT NULL,
  side               TEXT NOT NULL CHECK (side IN ('BACK', 'LAY')),
  requested_price    DECIMAL(10,3) NOT NULL,
  matched_price      DECIMAL(10,3),
  stake              DECIMAL(10,2) NOT NULL,
  reason             TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','MATCHED','SETTLED','SKIPPED','FAILED')),
  outcome            TEXT CHECK (outcome IN ('WON', 'LOST')),
  pnl                DECIMAL(10,2),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at         TIMESTAMPTZ
);

-- In-memory audit (persisted for debug/restart recovery)
CREATE TABLE IF NOT EXISTS scalpy_match_states (
  genius_id      TEXT PRIMARY KEY,
  home_team      TEXT NOT NULL,
  away_team      TEXT NOT NULL,
  total_goals    INTEGER NOT NULL DEFAULT 0,
  phase          TEXT,
  betting_done   BOOLEAN NOT NULL DEFAULT false,
  last_event_ts  TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Verify tables exist**

In Supabase dashboard → Table Editor, confirm both `scalpy_trades` and `scalpy_match_states` appear with correct columns.

- [ ] **Step 3: Commit (no code change — note in git)**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit --allow-empty -m "chore: create scalpy_trades + scalpy_match_states in Supabase (manual migration)"
```

---

## Task 2: geniusBackend — Events Buffer Endpoint

**Files:**
- Create: `geniusBackend/src/services/feed/events.service.js`
- Modify: `geniusBackend/src/routes/feed.routes.js`

- [ ] **Step 1: Read the existing ably service to confirm buffer method names**

```bash
# Run in geniusBackend directory
grep -n "getRecentFeedData\|getAllCachedData\|getRawFeed\|rawFeedData" src/services/ably.service.js
```

Expected output shows methods like `getAllCachedData(fixtureId)` and `getRecentFeedData(fixtureId, limit)`.

- [ ] **Step 2: Create `src/services/feed/events.service.js`**

```js
import { ablyService } from '../ably.service.js';

/**
 * Returns a flat array of events from the in-memory Ably buffer,
 * optionally filtered to events after `since` (ISO string).
 *
 * Each event shape: { type, timestamp, ...typeSpecificFields }
 */
export class EventsService {
  static getEvents(fixtureId, since = null) {
    if (!ablyService.isSubscribed(fixtureId)) {
      throw new Error('Feed not found. Please start the feed first.');
    }

    // getAllCachedData returns array of feedUpdate objects:
    // { timestamp, matchStatus, actions: { goals: [...], stoppageTimeAnnouncements: [...], ... } }
    const buffer = ablyService.getAllCachedData(fixtureId) ?? [];

    const sinceMs = since ? new Date(since).getTime() : 0;

    const events = [];

    for (const feedUpdate of buffer) {
      if (!feedUpdate?.actions) continue;

      for (const [type, actions] of Object.entries(feedUpdate.actions)) {
        if (!Array.isArray(actions)) continue;

        for (const action of actions) {
          const ts = action.timestamp
            ? new Date(action.timestamp).getTime()
            : new Date(feedUpdate.timestamp ?? 0).getTime();

          if (ts > sinceMs) {
            events.push({ type, timestamp: action.timestamp ?? feedUpdate.timestamp, ...action });
          }
        }
      }
    }

    // Sort chronologically
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return events;
  }
}
```

- [ ] **Step 3: Add route to `src/routes/feed.routes.js`**

Read the current file first, then add the new route after the existing `/:id/last-action` route:

```js
import express from 'express';
import { LastActionService } from '../services/feed/last-action.service.js';
import { EventsService } from '../services/feed/events.service.js';

const router = express.Router();

router.get('/:id/last-action', async (req, res) => {
  try {
    const result = await LastActionService.getLastAction(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error getting last action:', error);
    res.status(error.message.includes('Feed not found') ? 404 : 500).json({
      status: 'error',
      message: error.message
    });
  }
});

// New: GET /api/feed/:id/events?since=<ISO-timestamp>
router.get('/:id/events', (req, res) => {
  try {
    const events = EventsService.getEvents(req.params.id, req.query.since ?? null);
    res.json({ status: 'success', count: events.length, events });
  } catch (error) {
    console.error('[feed/events] Error:', error.message);
    res.status(error.message.includes('Feed not found') ? 404 : 500).json({
      status: 'error',
      message: error.message
    });
  }
});

export { router as feedRoutes };
```

- [ ] **Step 4: Manual test — start a feed and call the events endpoint**

```bash
# 1. Start geniusBackend
# 2. Start a feed for a known fixture (replace 12345 with real geniusId)
curl -X POST http://localhost:3003/api/feed/start/12345

# 3. Wait 10 seconds, then call events
curl "http://localhost:3003/api/feed/12345/events"

# Expected: { status: 'success', count: N, events: [...] }

# 4. Test with since filter
curl "http://localhost:3003/api/feed/12345/events?since=2026-01-01T00:00:00Z"
```

- [ ] **Step 5: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\geniusBackend" add src/services/feed/events.service.js src/routes/feed.routes.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\geniusBackend" commit -m "feat: add GET /api/feed/:id/events endpoint with since filter"
```

---

## Task 3: Supabase Client in bettrade-engine

**Files:**
- Modify: `bettrade-engine/package.json`
- Create: `bettrade-engine/src/lib/supabase.js`
- Modify: `bettrade-engine/.env` and `bettrade-engine/.env.example`

- [ ] **Step 1: Install @supabase/supabase-js**

```bash
cd "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine"
npm install @supabase/supabase-js
```

Expected: `added 1 package` (or similar).

- [ ] **Step 2: Add env vars to `.env`**

Append to `bettrade-engine/.env`:
```env
# Supabase (same project as geniusBackend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Scalpy
SCALPY_DRY_RUN=true
SCALPY_FEED_POLL_MS=3000
```

- [ ] **Step 3: Add same vars to `.env.example`**

Append to `bettrade-engine/.env.example`:
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Scalpy (set SCALPY_DRY_RUN=false only when ready for live trading)
SCALPY_DRY_RUN=true
SCALPY_FEED_POLL_MS=3000
```

- [ ] **Step 4: Create `src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
}

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
})
```

- [ ] **Step 5: Verify connection**

```bash
# In bettrade-engine directory, run a quick test
node --input-type=module <<'EOF'
import 'dotenv/config'
import { supabase } from './src/lib/supabase.js'
const { data, error } = await supabase.from('scalpy_trades').select('id').limit(1)
if (error) { console.error('FAIL:', error.message); process.exit(1) }
console.log('OK — Supabase connected, scalpy_trades accessible')
EOF
```

Expected output: `OK — Supabase connected, scalpy_trades accessible`

- [ ] **Step 6: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add package.json package-lock.json src/lib/supabase.js .env.example
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add Supabase client to bettrade-engine"
```

---

## Task 4: Trade Repository

**Files:**
- Create: `bettrade-engine/src/repositories/trade.repository.js`

- [ ] **Step 1: Create `src/repositories/trade.repository.js`**

```js
import { supabase } from '../lib/supabase.js'

/**
 * Save a new trade record. Returns the created row.
 * @param {Object} trade
 * @param {string} trade.geniusId
 * @param {string} trade.betfairEventId
 * @param {string} trade.betfairMarketId
 * @param {number} trade.selectionId
 * @param {string} trade.homeTeam
 * @param {string} trade.awayTeam
 * @param {number} trade.totalGoals
 * @param {number} trade.addedMinutes
 * @param {string} trade.marketType        e.g. "OVER_UNDER_25"
 * @param {string} trade.selection         "UNDER" | "OVER"
 * @param {string} trade.side              "BACK" | "LAY"
 * @param {number} trade.requestedPrice
 * @param {number} trade.stake
 * @param {string} trade.reason
 * @param {boolean} trade.dryRun
 * @param {string|null} trade.betId        null in DRY_RUN
 * @param {number|null} trade.matchedPrice null in DRY_RUN
 */
export async function saveTrade(trade) {
  const { data, error } = await supabase
    .from('scalpy_trades')
    .insert({
      bet_id:            trade.betId ?? null,
      dry_run:           trade.dryRun,
      genius_id:         trade.geniusId,
      betfair_event_id:  trade.betfairEventId,
      betfair_market_id: trade.betfairMarketId,
      selection_id:      trade.selectionId,
      home_team:         trade.homeTeam,
      away_team:         trade.awayTeam,
      total_goals:       trade.totalGoals,
      added_minutes:     trade.addedMinutes,
      market_type:       trade.marketType,
      selection:         trade.selection,
      side:              trade.side,
      requested_price:   trade.requestedPrice,
      matched_price:     trade.matchedPrice ?? null,
      stake:             trade.stake,
      reason:            trade.reason ?? null,
      status:            trade.betId ? 'PENDING' : 'PENDING',
    })
    .select()
    .single()

  if (error) throw new Error(`[trade.repository] saveTrade failed: ${error.message}`)
  return data
}

/**
 * Settle a trade after the market resolves.
 * @param {string} tradeId - UUID of the trade row
 * @param {'WON'|'LOST'} outcome
 * @param {number} pnl - net profit/loss in GBP
 */
export async function settleTrade(tradeId, outcome, pnl) {
  const { error } = await supabase
    .from('scalpy_trades')
    .update({
      outcome,
      pnl,
      status: 'SETTLED',
      settled_at: new Date().toISOString(),
    })
    .eq('id', tradeId)

  if (error) throw new Error(`[trade.repository] settleTrade failed: ${error.message}`)
}

/**
 * Get recent trades with optional filters.
 * @param {{ limit?: number, dryRun?: boolean, status?: string }} opts
 */
export async function getTrades({ limit = 50, dryRun, status } = {}) {
  let query = supabase
    .from('scalpy_trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (dryRun !== undefined) query = query.eq('dry_run', dryRun)
  if (status)               query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(`[trade.repository] getTrades failed: ${error.message}`)
  return data
}

/**
 * Get a single trade by ID.
 */
export async function getTradeById(id) {
  const { data, error } = await supabase
    .from('scalpy_trades')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`[trade.repository] getTradeById failed: ${error.message}`)
  return data
}

/**
 * Get PENDING trades (for settlement poller).
 */
export async function getPendingTrades() {
  const { data, error } = await supabase
    .from('scalpy_trades')
    .select('*')
    .eq('status', 'PENDING')

  if (error) throw new Error(`[trade.repository] getPendingTrades failed: ${error.message}`)
  return data
}

/**
 * P&L summary.
 */
export async function getSummary() {
  const { data, error } = await supabase
    .from('scalpy_trades')
    .select('pnl, status, outcome, dry_run, created_at')

  if (error) throw new Error(`[trade.repository] getSummary failed: ${error.message}`)

  const settled = data.filter(t => t.status === 'SETTLED')
  const today = new Date().toISOString().slice(0, 10)
  const todaySettled = settled.filter(t => t.created_at?.startsWith(today))

  return {
    total: data.length,
    settled: settled.length,
    won: settled.filter(t => t.outcome === 'WON').length,
    lost: settled.filter(t => t.outcome === 'LOST').length,
    winRate: settled.length > 0
      ? Math.round((settled.filter(t => t.outcome === 'WON').length / settled.length) * 100)
      : null,
    totalPnl: settled.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
    todayPnl: todaySettled.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
  }
}
```

- [ ] **Step 2: Quick smoke test**

```bash
node --input-type=module <<'EOF'
import 'dotenv/config'
import { getSummary } from './src/repositories/trade.repository.js'
const s = await getSummary()
console.log('Summary:', JSON.stringify(s))
console.log('OK')
EOF
```

Expected: `Summary: {"total":0,"settled":0,...}` and `OK`

- [ ] **Step 3: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add src/repositories/trade.repository.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add trade repository for Supabase scalpy_trades"
```

---

## Task 5: Betfair U/O Market Service

**Files:**
- Create: `bettrade-engine/src/services/betfair-ou-market.service.js`

- [ ] **Step 1: Create `src/services/betfair-ou-market.service.js`**

```js
import axios from 'axios'
import { getSessionToken } from './betfair-auth.service.js'

const BETTING_API = 'https://api.betfair.com/exchange/betting/rest/v1.0'

// Map total goals → Betfair marketTypeCode
export function goalCountToMarketType(totalGoals) {
  const capped = Math.min(totalGoals, 5)
  return `OVER_UNDER_${capped}5`
}

/**
 * Fetch the Under/Over market for a given Betfair eventId and marketType.
 * Returns null if no market found.
 *
 * @param {string} eventId       - Betfair event ID (e.g. "29001234")
 * @param {string} marketType    - e.g. "OVER_UNDER_25"
 * @returns {{ marketId, underSelectionId, overSelectionId, bestBackUnder, bestLayUnder, bestBackOver, bestLayOver } | null}
 */
export async function getOuMarket(eventId, marketType) {
  const appKey      = process.env.BETFAIR_APP_KEY
  const sessionToken = getSessionToken()

  const headers = {
    'X-Application':    appKey,
    'X-Authentication': sessionToken,
    'Content-Type':     'application/json',
    Accept:             'application/json',
  }

  // Step 1: list market catalogue
  const catalogueRes = await axios.post(
    `${BETTING_API}/listMarketCatalogue/`,
    {
      filter: {
        eventIds: [eventId],
        marketTypeCodes: [marketType],
      },
      marketProjection: ['RUNNER_DESCRIPTION'],
      maxResults: 5,
    },
    { headers }
  )

  const markets = catalogueRes.data
  if (!markets || markets.length === 0) {
    console.warn(`[betfair-ou] No ${marketType} market found for eventId ${eventId}`)
    return null
  }

  const market = markets[0]
  const marketId = market.marketId

  // Identify Under and Over runners by name
  const underRunner = market.runners?.find(r =>
    r.runnerName?.toLowerCase().includes('under')
  )
  const overRunner = market.runners?.find(r =>
    r.runnerName?.toLowerCase().includes('over')
  )

  if (!underRunner || !overRunner) {
    console.warn(`[betfair-ou] Could not identify Under/Over runners for market ${marketId}`)
    return null
  }

  // Step 2: fetch live book for this market
  const bookRes = await axios.post(
    `${BETTING_API}/listMarketBook/`,
    {
      marketIds: [marketId],
      priceProjection: {
        priceData: ['EX_BEST_OFFERS'],
        exBestOffersOverrides: { bestPricesDepth: 1 },
      },
    },
    { headers }
  )

  const book = bookRes.data?.[0]
  if (!book) return null

  const bookMap = new Map(book.runners?.map(r => [r.selectionId, r]) ?? [])

  const underBook = bookMap.get(underRunner.selectionId)
  const overBook  = bookMap.get(overRunner.selectionId)

  return {
    marketId,
    marketType,
    underSelectionId: underRunner.selectionId,
    overSelectionId:  overRunner.selectionId,
    bestBackUnder: underBook?.ex?.availableToBack?.[0]?.price ?? null,
    bestLayUnder:  underBook?.ex?.availableToLay?.[0]?.price  ?? null,
    bestBackOver:  overBook?.ex?.availableToBack?.[0]?.price  ?? null,
    bestLayOver:   overBook?.ex?.availableToLay?.[0]?.price   ?? null,
  }
}
```

- [ ] **Step 2: Manual test (requires running bettrade-engine with valid Betfair session)**

```bash
node --input-type=module <<'EOF'
import 'dotenv/config'
import { login } from './src/services/betfair-auth.service.js'
import { getOuMarket, goalCountToMarketType } from './src/services/betfair-ou-market.service.js'

await login()
// Replace with a real eventId from your overlap list
const result = await getOuMarket('29001234', goalCountToMarketType(2))
console.log('Market:', JSON.stringify(result, null, 2))
EOF
```

Expected: object with `marketId`, `underSelectionId`, `overSelectionId`, `bestBackUnder`, etc.

- [ ] **Step 3: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add src/services/betfair-ou-market.service.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add Betfair U/O market fetcher service"
```

---

## Task 6: Betfair Order Placement Service

**Files:**
- Create: `bettrade-engine/src/services/betfair-orders.service.js`

- [ ] **Step 1: Create `src/services/betfair-orders.service.js`**

```js
import axios from 'axios'
import { getSessionToken } from './betfair-auth.service.js'

const BETTING_API = 'https://api.betfair.com/exchange/betting/rest/v1.0'

/**
 * Place a limit order on Betfair, or simulate it in DRY_RUN mode.
 *
 * @param {Object} params
 * @param {string}  params.marketId
 * @param {number}  params.selectionId
 * @param {'BACK'|'LAY'} params.side
 * @param {number}  params.price           Betfair decimal price (e.g. 1.18)
 * @param {number}  params.size            Stake in GBP
 * @param {string}  params.customerRef     Unique reference (e.g. "scalpy_<uuid>")
 *
 * @returns {{ betId: string|null, status: string, matchedSize: number, averagePrice: number|null }}
 */
export async function placeOrder({ marketId, selectionId, side, price, size, customerRef }) {
  const dryRun = process.env.SCALPY_DRY_RUN !== 'false'

  if (dryRun) {
    console.log(`[betfair-orders] DRY_RUN — would place ${side} ${size} @ ${price} on market ${marketId} sel ${selectionId}`)
    return {
      betId:        null,
      status:       'DRY_RUN',
      matchedSize:  0,
      averagePrice: null,
    }
  }

  const appKey       = process.env.BETFAIR_APP_KEY
  const sessionToken = getSessionToken()

  const body = {
    marketId,
    instructions: [{
      selectionId,
      handicap:  0,
      side,
      orderType: 'LIMIT',
      limitOrder: {
        size,
        price,
        persistenceType: 'LAPSE',
      },
    }],
    customerRef,
  }

  const response = await axios.post(
    `${BETTING_API}/placeOrders/`,
    body,
    {
      headers: {
        'X-Application':    appKey,
        'X-Authentication': sessionToken,
        'Content-Type':     'application/json',
        Accept:             'application/json',
      },
    }
  )

  const result = response.data
  if (result.status !== 'SUCCESS') {
    throw new Error(`[betfair-orders] placeOrders failed: ${JSON.stringify(result)}`)
  }

  const report = result.instructionReports?.[0]
  if (report?.status !== 'SUCCESS') {
    throw new Error(`[betfair-orders] Instruction failed: ${JSON.stringify(report)}`)
  }

  return {
    betId:        report.betId,
    status:       report.status,
    matchedSize:  report.sizeMatched ?? 0,
    averagePrice: report.averagePriceMatched ?? null,
  }
}
```

- [ ] **Step 2: Verify DRY_RUN mode returns correct shape**

```bash
node --input-type=module <<'EOF'
import 'dotenv/config'
import { placeOrder } from './src/services/betfair-orders.service.js'

// SCALPY_DRY_RUN=true by default in .env
const result = await placeOrder({
  marketId: '1.234567',
  selectionId: 12345678,
  side: 'BACK',
  price: 1.18,
  size: 10,
  customerRef: 'scalpy_test_001'
})
console.log('Result:', JSON.stringify(result))
// Expected: { betId: null, status: 'DRY_RUN', matchedSize: 0, averagePrice: null }
EOF
```

- [ ] **Step 3: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add src/services/betfair-orders.service.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add Betfair order placement service with DRY_RUN mode"
```

---

## Task 7: Algorithm Module

**Files:**
- Create: `bettrade-engine/scalpy-config.json`
- Create: `bettrade-engine/src/scalpy/scalpy.algorithm.js`

- [ ] **Step 1: Create `scalpy-config.json` in bettrade-engine root**

```json
{
  "stake": 10,
  "currency": "GBP",
  "rules": [
    { "addedMinutes": 3, "selection": "UNDER", "side": "BACK", "price": 1.18 },
    { "addedMinutes": 4, "selection": "UNDER", "side": "BACK", "price": 1.22 },
    { "addedMinutes": 5, "selection": "UNDER", "side": "BACK", "price": 1.25 },
    { "addedMinutes": 6, "selection": "UNDER", "side": "BACK", "price": 1.28 }
  ]
}
```

> Note: These are placeholder rules. The real algorithm will be provided separately. The config is hot-reloadable via `POST /api/scalpy/config`.

- [ ] **Step 2: Create `src/scalpy/scalpy.algorithm.js`**

```js
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = resolve(__dirname, '../../scalpy-config.json')

let cachedConfig = null

export function loadConfig() {
  const raw = readFileSync(CONFIG_PATH, 'utf-8')
  cachedConfig = JSON.parse(raw)
  console.log(`[scalpy.algorithm] Config loaded: ${cachedConfig.rules.length} rules, stake=${cachedConfig.stake}`)
  return cachedConfig
}

export function getConfig() {
  if (!cachedConfig) loadConfig()
  return cachedConfig
}

/**
 * Decide what action to take given current match state and market prices.
 *
 * @param {Object} params
 * @param {number} params.addedMinutes   - Stoppage time minutes announced
 * @param {number} params.totalGoals     - Total goals scored so far
 * @param {number|null} params.bestBackUnder  - Best available BACK price for Under runner
 * @param {number|null} params.bestLayUnder   - Best available LAY price for Under runner
 * @param {number|null} params.bestBackOver   - Best available BACK price for Over runner
 * @param {number|null} params.bestLayOver    - Best available LAY price for Over runner
 *
 * @returns {{ action: 'BACK'|'LAY'|'SKIP', selection?: string, price?: number, stake?: number, reason: string }}
 */
export function decide({ addedMinutes, totalGoals, bestBackUnder, bestLayUnder, bestBackOver, bestLayOver }) {
  const config = getConfig()

  // Find matching rule
  const rule = config.rules.find(r => r.addedMinutes === addedMinutes)
  if (!rule) {
    return { action: 'SKIP', reason: `no_rule_for_${addedMinutes}_added_minutes` }
  }

  // Get the relevant market price based on selection + side
  let availablePrice = null
  if (rule.selection === 'UNDER' && rule.side === 'BACK') availablePrice = bestBackUnder
  if (rule.selection === 'UNDER' && rule.side === 'LAY')  availablePrice = bestLayUnder
  if (rule.selection === 'OVER'  && rule.side === 'BACK') availablePrice = bestBackOver
  if (rule.selection === 'OVER'  && rule.side === 'LAY')  availablePrice = bestLayOver

  if (availablePrice === null) {
    return { action: 'SKIP', reason: 'price_unavailable' }
  }

  // Price viability check
  if (rule.side === 'BACK' && availablePrice < rule.price) {
    return {
      action: 'SKIP',
      reason: `back_price_too_low: available=${availablePrice} required>=${rule.price}`
    }
  }
  if (rule.side === 'LAY' && availablePrice > rule.price) {
    return {
      action: 'SKIP',
      reason: `lay_price_too_high: available=${availablePrice} required<=${rule.price}`
    }
  }

  return {
    action:    rule.side,       // 'BACK' or 'LAY'
    selection: rule.selection,  // 'UNDER' or 'OVER'
    price:     rule.price,
    stake:     config.stake,
    reason:    `rule_matched: ${addedMinutes}min → ${rule.side} ${rule.selection} @ ${rule.price}`,
  }
}
```

- [ ] **Step 3: Test algorithm decisions**

```bash
node --input-type=module <<'EOF'
import { decide, loadConfig } from './src/scalpy/scalpy.algorithm.js'

loadConfig()

// Should trigger BACK
const r1 = decide({ addedMinutes: 3, totalGoals: 2, bestBackUnder: 1.20, bestLayUnder: 1.22, bestBackOver: null, bestLayOver: null })
console.log('3min BACK test:', r1)
// Expected: { action: 'BACK', selection: 'UNDER', price: 1.18, stake: 10, reason: '...' }

// Should SKIP — available price too low
const r2 = decide({ addedMinutes: 3, totalGoals: 2, bestBackUnder: 1.15, bestLayUnder: 1.17, bestBackOver: null, bestLayOver: null })
console.log('3min SKIP test:', r2)
// Expected: { action: 'SKIP', reason: 'back_price_too_low: ...' }

// Should SKIP — no rule for 7 minutes
const r3 = decide({ addedMinutes: 7, totalGoals: 1, bestBackUnder: 1.30, bestLayUnder: 1.32, bestBackOver: null, bestLayOver: null })
console.log('7min SKIP test:', r3)
// Expected: { action: 'SKIP', reason: 'no_rule_for_7_added_minutes' }
EOF
```

- [ ] **Step 4: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add scalpy-config.json src/scalpy/scalpy.algorithm.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add scalpy algorithm module with config-driven decision engine"
```

---

## Task 8: Match State Store

**Files:**
- Create: `bettrade-engine/src/scalpy/scalpy.match-state.js`

- [ ] **Step 1: Create `src/scalpy/scalpy.match-state.js`**

```js
/**
 * In-memory match state per fixture (keyed by geniusId).
 * Tracks goal count, phase, and whether a bet has been placed.
 */

/** @type {Map<string, MatchState>} */
const states = new Map()

/**
 * @typedef {Object} MatchState
 * @property {string}  geniusId
 * @property {string}  homeTeam
 * @property {string}  awayTeam
 * @property {string}  betfairEventId
 * @property {string}  betfairMarketId   - MATCH_ODDS market ID (from overlap)
 * @property {number}  totalGoals
 * @property {string|null} phase         - e.g. 'FirstHalf', 'SecondHalf', 'FullTime'
 * @property {boolean} bettingDone
 * @property {string|null} lastSeenTs    - ISO timestamp of last processed event
 */

/**
 * Initialise state for a newly tracked fixture (idempotent).
 */
export function initState(fixture) {
  if (states.has(fixture.geniusId)) return
  states.set(fixture.geniusId, {
    geniusId:        fixture.geniusId,
    homeTeam:        fixture.homeTeam,
    awayTeam:        fixture.awayTeam,
    betfairEventId:  fixture.betfairEventId,
    betfairMarketId: fixture.betfairMarketId,
    totalGoals:      0,
    phase:           null,
    bettingDone:     false,
    lastSeenTs:      null,
  })
  console.log(`[match-state] Initialised state for ${fixture.homeTeam} v ${fixture.awayTeam} (geniusId=${fixture.geniusId})`)
}

export function getState(geniusId) {
  return states.get(geniusId) ?? null
}

export function getAllStates() {
  return Array.from(states.values())
}

export function hasState(geniusId) {
  return states.has(geniusId)
}

export function incrementGoals(geniusId) {
  const s = states.get(geniusId)
  if (!s) return
  s.totalGoals += 1
  console.log(`[match-state] Goal! geniusId=${geniusId} totalGoals=${s.totalGoals}`)
}

export function setPhase(geniusId, phase) {
  const s = states.get(geniusId)
  if (!s) return
  s.phase = phase
  console.log(`[match-state] Phase change: geniusId=${geniusId} phase=${phase}`)
}

export function setBettingDone(geniusId) {
  const s = states.get(geniusId)
  if (!s) return
  s.bettingDone = true
}

export function setLastSeenTs(geniusId, ts) {
  const s = states.get(geniusId)
  if (!s) return
  s.lastSeenTs = ts
}

export function clearState(geniusId) {
  states.delete(geniusId)
}
```

- [ ] **Step 2: Test state transitions**

```bash
node --input-type=module <<'EOF'
import {
  initState, getState, incrementGoals,
  setPhase, setBettingDone, hasState
} from './src/scalpy/scalpy.match-state.js'

const fixture = {
  geniusId: 'test-123',
  homeTeam: 'Fenerbahce',
  awayTeam: 'Besiktas',
  betfairEventId: '29001234',
  betfairMarketId: '1.234567'
}

initState(fixture)
initState(fixture) // idempotent — should not overwrite

incrementGoals('test-123')
incrementGoals('test-123')
setPhase('test-123', 'SecondHalf')
setBettingDone('test-123')

const s = getState('test-123')
console.log('State:', JSON.stringify(s))
// Expected: totalGoals=2, phase='SecondHalf', bettingDone=true

console.log('hasState:', hasState('test-123'))  // true
console.log('hasState (unknown):', hasState('xxx'))  // false
console.log('OK')
EOF
```

- [ ] **Step 3: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add src/scalpy/scalpy.match-state.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add in-memory match state store for Scalpy"
```

---

## Task 9: ScalpyEngine Core

**Files:**
- Create: `bettrade-engine/src/scalpy/scalpy.engine.js`

- [ ] **Step 1: Create `src/scalpy/scalpy.engine.js`**

```js
import axios from 'axios'
import {
  initState, getState, getAllStates,
  incrementGoals, setPhase, setBettingDone, setLastSeenTs
} from './scalpy.match-state.js'
import { goalCountToMarketType, getOuMarket } from '../services/betfair-ou-market.service.js'
import { placeOrder } from '../services/betfair-orders.service.js'
import { decide, loadConfig } from './scalpy.algorithm.js'
import { saveTrade } from '../repositories/trade.repository.js'
import { broadcast } from './scalpy.sse.js'
import { getOverlap } from '../services/overlap.service.js'

const FEED_POLL_MS  = parseInt(process.env.SCALPY_FEED_POLL_MS ?? '3000', 10)
const GENIUS_URL    = process.env.GENIUS_BACKEND_URL ?? 'http://localhost:3003'

/** Set of geniusIds currently being polled */
const polledFixtures = new Set()

let pollIntervals = []

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export function startEngine() {
  loadConfig()
  console.log('[scalpy.engine] Engine started')

  // Every 30s: sync live fixtures from overlap store
  const syncInterval = setInterval(syncLiveFixtures, 30_000)
  syncLiveFixtures() // immediate first run

  pollIntervals.push(syncInterval)
}

export function stopEngine() {
  pollIntervals.forEach(clearInterval)
  pollIntervals = []
  polledFixtures.clear()
  console.log('[scalpy.engine] Engine stopped')
}

// ------------------------------------------------------------------
// Internal
// ------------------------------------------------------------------

async function syncLiveFixtures() {
  const { fixtures } = getOverlap()
  const liveFixtures = fixtures.filter(f =>
    f.status === 'IN_PLAY' || f.market?.inplay === true
  )

  for (const fixture of liveFixtures) {
    const { geniusId } = fixture
    initState(fixture)

    if (!polledFixtures.has(geniusId)) {
      polledFixtures.add(geniusId)
      await startFeedForFixture(geniusId)
      const interval = setInterval(() => pollEvents(geniusId), FEED_POLL_MS)
      pollIntervals.push(interval)
      console.log(`[scalpy.engine] Now polling fixture geniusId=${geniusId}`)
    }
  }

  broadcast({ type: 'match_states', data: getAllStates() })
}

async function startFeedForFixture(geniusId) {
  try {
    await axios.post(`${GENIUS_URL}/api/feed/start/${geniusId}`)
    console.log(`[scalpy.engine] Feed started for geniusId=${geniusId}`)
  } catch (err) {
    console.error(`[scalpy.engine] Failed to start feed for ${geniusId}:`, err.message)
  }
}

async function pollEvents(geniusId) {
  const state = getState(geniusId)
  if (!state) return

  try {
    const res = await axios.get(`${GENIUS_URL}/api/feed/${geniusId}/events`, {
      params: { since: state.lastSeenTs ?? undefined },
    })

    const events = res.data?.events ?? []
    if (events.length === 0) return

    for (const event of events) {
      await processEvent(geniusId, event)
    }

    // Update lastSeenTs to the timestamp of the most recent event processed
    const lastTs = events[events.length - 1]?.timestamp
    if (lastTs) setLastSeenTs(geniusId, lastTs)
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error(`[scalpy.engine] Poll error for ${geniusId}:`, err.message)
    }
  }
}

async function processEvent(geniusId, event) {
  const state = getState(geniusId)
  if (!state) return

  switch (event.type) {
    case 'goals':
      // Increment total goals (any goal, home or away)
      // isOwnGoal is still a goal so count it
      incrementGoals(geniusId)
      broadcast({ type: 'goal', geniusId, data: { totalGoals: getState(geniusId).totalGoals } })
      break

    case 'phaseChanges':
      setPhase(geniusId, event.currentPhase)
      broadcast({ type: 'phase_change', geniusId, data: { phase: event.currentPhase } })

      if (event.currentPhase === 'FullTime') {
        console.log(`[scalpy.engine] FullTime detected for geniusId=${geniusId}`)
        broadcast({ type: 'full_time', geniusId })
      }
      break

    case 'stoppageTimeAnnouncements':
      await handleStoppageTime(geniusId, event)
      break

    default:
      // Ignore other event types
      break
  }
}

async function handleStoppageTime(geniusId, event) {
  const state = getState(geniusId)
  if (!state) return

  // Guard: only act on SecondHalf stoppage
  if (event.phase !== 'SecondHalf') {
    console.log(`[scalpy.engine] Stoppage in ${event.phase} — skipping (not SecondHalf)`)
    return
  }

  // Guard: only bet once per match
  if (state.bettingDone) {
    console.log(`[scalpy.engine] bettingDone=true for geniusId=${geniusId} — skipping`)
    return
  }

  const addedMinutes = event.addedMinutes
  console.log(`[scalpy.engine] Stoppage detected! geniusId=${geniusId} addedMinutes=${addedMinutes} totalGoals=${state.totalGoals}`)

  setBettingDone(geniusId)

  try {
    // Determine which U/O market to trade
    const marketType = goalCountToMarketType(state.totalGoals)
    const ouMarket   = await getOuMarket(state.betfairEventId, marketType)

    if (!ouMarket) {
      console.warn(`[scalpy.engine] No ${marketType} market found — cannot bet`)
      broadcast({ type: 'bet_skipped', geniusId, data: { reason: 'no_market_found', marketType } })
      return
    }

    // Run algorithm
    const decision = decide({
      addedMinutes,
      totalGoals:     state.totalGoals,
      bestBackUnder:  ouMarket.bestBackUnder,
      bestLayUnder:   ouMarket.bestLayUnder,
      bestBackOver:   ouMarket.bestBackOver,
      bestLayOver:    ouMarket.bestLayOver,
    })

    console.log(`[scalpy.engine] Decision: ${JSON.stringify(decision)}`)

    if (decision.action === 'SKIP') {
      console.log(`[scalpy.engine] SKIP — reason: ${decision.reason}`)
      broadcast({ type: 'bet_skipped', geniusId, data: { reason: decision.reason, addedMinutes } })
      return
    }

    // Determine selectionId from decision
    const selectionId = decision.selection === 'UNDER'
      ? ouMarket.underSelectionId
      : ouMarket.overSelectionId

    // Place order
    const customerRef = `scalpy_${geniusId}_${Date.now()}`
    const orderResult = await placeOrder({
      marketId:    ouMarket.marketId,
      selectionId,
      side:        decision.action,
      price:       decision.price,
      size:        decision.stake,
      customerRef,
    })

    console.log(`[scalpy.engine] Order result: ${JSON.stringify(orderResult)}`)

    // Persist to Supabase
    const dryRun = process.env.SCALPY_DRY_RUN !== 'false'
    const trade = await saveTrade({
      geniusId:         state.geniusId,
      betfairEventId:   state.betfairEventId,
      betfairMarketId:  ouMarket.marketId,
      selectionId,
      homeTeam:         state.homeTeam,
      awayTeam:         state.awayTeam,
      totalGoals:       state.totalGoals,
      addedMinutes,
      marketType:       ouMarket.marketType,
      selection:        decision.selection,
      side:             decision.action,
      requestedPrice:   decision.price,
      matchedPrice:     orderResult.averagePrice,
      stake:            decision.stake,
      reason:           decision.reason,
      dryRun,
      betId:            orderResult.betId,
    })

    broadcast({
      type: 'bet_placed',
      geniusId,
      data: {
        tradeId:     trade.id,
        side:        decision.action,
        selection:   decision.selection,
        price:       decision.price,
        stake:       decision.stake,
        marketType:  ouMarket.marketType,
        addedMinutes,
        dryRun,
      },
    })

  } catch (err) {
    console.error(`[scalpy.engine] Error during handleStoppageTime:`, err.message)
    broadcast({ type: 'error', geniusId, data: { message: err.message } })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add src/scalpy/scalpy.engine.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add ScalpyEngine — event-driven trading orchestrator"
```

---

## Task 10: SSE Broadcaster + API Routes

**Files:**
- Create: `bettrade-engine/src/scalpy/scalpy.sse.js`
- Create: `bettrade-engine/src/routes/scalpy.routes.js`

- [ ] **Step 1: Create `src/scalpy/scalpy.sse.js`**

```js
/** @type {Set<import('http').ServerResponse>} */
const clients = new Set()

/**
 * Register a new SSE client connection.
 * Call this in the Express route handler.
 */
export function addClient(res) {
  clients.add(res)
  res.on('close', () => clients.delete(res))
}

/**
 * Broadcast a JSON event to all connected SSE clients.
 * @param {Object} payload
 */
export function broadcast(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const res of clients) {
    try {
      res.write(data)
    } catch {
      clients.delete(res)
    }
  }
}
```

- [ ] **Step 2: Create `src/routes/scalpy.routes.js`**

```js
import { Router } from 'express'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { addClient } from '../scalpy/scalpy.sse.js'
import { loadConfig } from '../scalpy/scalpy.algorithm.js'
import { getTrades, getTradeById, getSummary } from '../repositories/trade.repository.js'
import { getAllStates } from '../scalpy/scalpy.match-state.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = resolve(__dirname, '../../scalpy-config.json')

const router = Router()

// GET /api/scalpy/stream — SSE live events
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send current states immediately on connect
  res.write(`data: ${JSON.stringify({ type: 'match_states', data: getAllStates() })}\n\n`)

  addClient(res)
})

// GET /api/scalpy/trades
router.get('/trades', async (req, res) => {
  try {
    const { limit = '50', dry_run, status } = req.query
    const trades = await getTrades({
      limit: parseInt(limit, 10),
      dryRun: dry_run === 'true' ? true : dry_run === 'false' ? false : undefined,
      status: status ?? undefined,
    })
    res.json({ ok: true, count: trades.length, trades })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/scalpy/trades/:id
router.get('/trades/:id', async (req, res) => {
  try {
    const trade = await getTradeById(req.params.id)
    res.json({ ok: true, trade })
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message })
  }
})

// GET /api/scalpy/summary
router.get('/summary', async (req, res) => {
  try {
    const summary = await getSummary()
    res.json({ ok: true, summary })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /api/scalpy/config — Hot-reload algorithm config
router.post('/config', (req, res) => {
  try {
    if (req.body && Object.keys(req.body).length > 0) {
      writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2))
    }
    const config = loadConfig()
    res.json({ ok: true, config })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

export { router as scalpyRoutes }
```

- [ ] **Step 3: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add src/scalpy/scalpy.sse.js src/routes/scalpy.routes.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add Scalpy SSE broadcaster and API routes"
```

---

## Task 11: Wire Engine into index.js + server.js

**Files:**
- Modify: `bettrade-engine/src/index.js`
- Modify: `bettrade-engine/src/server.js`

- [ ] **Step 1: Update `src/server.js`** to mount scalpy routes

Read the current server.js, then replace with:

```js
import express from 'express'
import cors from 'cors'
import { fixturesRoutes } from './routes/fixtures.routes.js'
import { scalpyRoutes } from './routes/scalpy.routes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'bettrade-engine', ts: new Date().toISOString() })
})

app.use('/api/v1/fixtures', fixturesRoutes)
app.use('/api/scalpy', scalpyRoutes)

export { app }
```

- [ ] **Step 2: Update `src/index.js`** to start ScalpyEngine

Read the current index.js, then replace with:

```js
import 'dotenv/config'
import { login } from './services/betfair-auth.service.js'
import { startPolling } from './services/overlap.service.js'
import { startEngine } from './scalpy/scalpy.engine.js'
import { app } from './server.js'

const PORT = process.env.PORT ?? 4001

async function main() {
  console.log('[engine] Starting bettrade-engine...')

  // Authenticate with Betfair
  await login()

  // Start overlap sync loop (existing)
  startPolling()

  // Start Scalpy trading engine
  startEngine()

  app.listen(PORT, () => {
    console.log(`[engine] Listening on http://localhost:${PORT}`)
    console.log(`[engine] Overlap: http://localhost:${PORT}/api/v1/fixtures/overlap`)
    console.log(`[engine] Scalpy stream: http://localhost:${PORT}/api/scalpy/stream`)
    console.log(`[engine] DRY_RUN mode: ${process.env.SCALPY_DRY_RUN !== 'false'}`)
  })
}

main().catch(err => {
  console.error('[engine] Fatal startup error:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Start the engine and verify logs**

```bash
cd "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine"
node src/index.js
```

Expected log lines (within 30s):
```
[engine] Starting bettrade-engine...
[betfair-auth] Logged in successfully
[overlap] Polling started (interval: 30000ms)
[scalpy.algorithm] Config loaded: 4 rules, stake=10
[scalpy.engine] Engine started
[engine] Listening on http://localhost:4001
[engine] DRY_RUN mode: true
```

If live fixtures exist in overlap:
```
[scalpy.engine] Initialised state for TeamA v TeamB (geniusId=12345)
[scalpy.engine] Now polling fixture geniusId=12345
```

- [ ] **Step 4: Test SSE stream endpoint**

```bash
curl -N http://localhost:4001/api/scalpy/stream
```

Expected: connection stays open and emits `data: {"type":"match_states","data":[...]}` immediately.

- [ ] **Step 5: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add src/index.js src/server.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: wire ScalpyEngine into bettrade-engine startup"
```

---

## Task 12: Settlement Service

**Files:**
- Create: `bettrade-engine/src/scalpy/scalpy.settlement.js`

- [ ] **Step 1: Create `src/scalpy/scalpy.settlement.js`**

```js
import { getPendingTrades, settleTrade } from '../repositories/trade.repository.js'
import { broadcast } from './scalpy.sse.js'

/**
 * Calculate DRY_RUN outcome based on final total goals.
 *
 * @param {Object} trade     - Trade row from Supabase
 * @param {number} finalGoals - Total goals at full time
 */
function calcDryRunOutcome(trade, finalGoals) {
  // OVER_UNDER_25 → '25' → 25/10 = 2.5  (safe for 05, 15, 25, 35, 45, 55)
  const threshold = parseFloat(trade.market_type.replace('OVER_UNDER_', '')) / 10

  // Under X.5 wins if final goals < threshold (e.g. goals < 2.5 → goals ≤ 2)
  const underWins = finalGoals < threshold

  let outcome
  if (trade.selection === 'UNDER') {
    outcome = trade.side === 'BACK'
      ? (underWins ? 'WON' : 'LOST')
      : (underWins ? 'LOST' : 'WON')
  } else {
    // OVER
    outcome = trade.side === 'BACK'
      ? (underWins ? 'LOST' : 'WON')
      : (underWins ? 'WON' : 'LOST')
  }

  let pnl
  if (trade.side === 'BACK') {
    pnl = outcome === 'WON'
      ? trade.stake * (trade.requested_price - 1)
      : -trade.stake
  } else {
    // LAY
    pnl = outcome === 'WON'
      ? trade.stake
      : -(trade.stake * (trade.requested_price - 1))
  }

  return { outcome, pnl: Math.round(pnl * 100) / 100 }
}

/**
 * Settle a single DRY_RUN trade using the final goal count from match state.
 */
export async function settleDryRunTrade(trade, finalGoals) {
  const { outcome, pnl } = calcDryRunOutcome(trade, finalGoals)
  await settleTrade(trade.id, outcome, pnl)
  console.log(`[settlement] DRY_RUN settled trade ${trade.id}: ${outcome} P&L=${pnl}`)
  broadcast({ type: 'trade_settled', data: { tradeId: trade.id, outcome, pnl, dryRun: true } })
}

/**
 * Called by ScalpyEngine when FullTime phase change detected.
 * Settles all DRY_RUN PENDING trades for this fixture.
 *
 * @param {string} geniusId
 * @param {number} finalGoals
 */
export async function settleFixture(geniusId, finalGoals) {
  try {
    const pending = await getPendingTrades()
    const forFixture = pending.filter(t => t.genius_id === geniusId && t.dry_run === true)

    for (const trade of forFixture) {
      await settleDryRunTrade(trade, finalGoals)
    }

    if (forFixture.length > 0) {
      console.log(`[settlement] Settled ${forFixture.length} DRY_RUN trade(s) for geniusId=${geniusId}`)
    }
  } catch (err) {
    console.error(`[settlement] Error settling fixture ${geniusId}:`, err.message)
  }
}
```

- [ ] **Step 2: Call settlement from ScalpyEngine on FullTime**

In `src/scalpy/scalpy.engine.js`, add import and call at the FullTime detection point.

In the `processEvent` function, update the `phaseChanges` case:

```js
// At top of file, add import:
import { settleFixture } from './scalpy.settlement.js'

// In processEvent, update phaseChanges case:
case 'phaseChanges':
  setPhase(geniusId, event.currentPhase)
  broadcast({ type: 'phase_change', geniusId, data: { phase: event.currentPhase } })

  if (event.currentPhase === 'FullTime') {
    console.log(`[scalpy.engine] FullTime detected for geniusId=${geniusId}`)
    broadcast({ type: 'full_time', geniusId })
    // Settle DRY_RUN trades
    const s = getState(geniusId)
    if (s) {
      await settleFixture(geniusId, s.totalGoals)
    }
  }
  break
```

- [ ] **Step 3: Commit**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" add src/scalpy/scalpy.settlement.js src/scalpy/scalpy.engine.js
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" commit -m "feat: add settlement service for DRY_RUN P&L calculation"
```

---

## End-to-End Smoke Test

After all backend tasks are complete:

- [ ] **Full integration test**

1. Start geniusBackend
2. Start bettrade-engine
3. Confirm a live matched fixture appears in overlap:
   ```bash
   curl http://localhost:4001/api/v1/fixtures/overlap | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('Live:', j.fixtures.filter(f=>f.status==='IN_PLAY').length)"
   ```
4. Connect to SSE stream:
   ```bash
   curl -N http://localhost:4001/api/scalpy/stream
   ```
5. Confirm `match_states` event received with tracked fixtures
6. When a live match reaches 90th minute + stoppage time, confirm in logs:
   ```
   [scalpy.engine] Stoppage detected! geniusId=XXX addedMinutes=N totalGoals=N
   [betfair-orders] DRY_RUN — would place BACK 10 @ 1.18 on market 1.XXX sel XXXXXX
   [scalpy.engine] Decision: {"action":"BACK","selection":"UNDER","price":1.18,...}
   ```
7. Verify trade saved in Supabase:
   ```bash
   curl http://localhost:4001/api/scalpy/trades
   ```

- [ ] **Commit final state**

```bash
git -C "C:\Users\ihsynzd\Documents\Dev\Github\Psychoff_Radar\bettrade-engine" tag -a v0.2.0-scalpy-engine -m "Scalpy engine complete (DRY_RUN mode)"
```

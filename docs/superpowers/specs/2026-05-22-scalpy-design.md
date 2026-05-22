# Scalpy — Betfair U/O Stoppage-Time Trading Bot: Design Spec

**Date:** 2026-05-22  
**Status:** Approved  
**Repos:** bettrade / bettrade-engine / geniusBackend

---

## 1. Overview

Scalpy is an automated trading bot that monitors football matches and places Betfair Under/Over bets at the moment stoppage time is announced at the 90th minute. The trigger is the `stoppageTimeAnnouncements` real-time event from Genius Sports (via Ably), which fires when the referee's board shows added minutes.

**Phase 1 scope (this spec):**
- Detect stoppage time in the Second Half via Genius Sports feed
- Determine the correct Under/Over market based on current goal count
- Apply a configurable algorithm (addedMinutes + score → BACK/LAY/SKIP)
- Place a Betfair limit order (or log in DRY_RUN mode)
- Persist trade history to Supabase
- Live monitoring dashboard at `/scalpy`

**Out of scope (Phase 2):**
- Predictive betting at 89:45 before official announcement
- Dynamic stake sizing
- First-half stoppage betting
- Multiple bets per match

---

## 2. Architecture

```
geniusBackend (Ably → live match events per fixture)
    │
    │  HTTP polling (bettrade-engine calls /api/feed/:id/events every 3s)
    │
    ▼
bettrade-engine (Port 4001)
    ├── [existing] betfair-auth.service.js       Betfair cert login + keep-alive
    ├── [existing] overlap.service.js            Genius ↔ Betfair match pairing
    ├── [new]      betfair-ou-market.service.js  Fetch U/O market catalogue + book
    ├── [new]      betfair-orders.service.js     placeOrders wrapper + DRY_RUN
    ├── [new]      trade.repository.js           Supabase read/write
    ├── [new]      scalpy/scalpy.algorithm.js    Decision engine (config-driven)
    ├── [new]      scalpy/scalpy.match-state.js  In-memory score/phase per fixture
    ├── [new]      scalpy/scalpy.engine.js       Polling loop + trigger orchestrator
    ├── [new]      scalpy/scalpy.settlement.js   Outcome + P&L settlement poller
    └── [new]      routes/scalpy.routes.js       REST + SSE endpoints
    │
    │  HTTP + SSE
    ▼
bettrade / Next.js (Port 4000)
    └── /scalpy  Live dashboard + trade history
```

**geniusBackend modification (minimal):**  
Add `GET /api/feed/:id/events?since=<ISO-timestamp>` endpoint exposing the existing in-memory buffer with flat event format. No other changes.

---

## 3. Trigger Data Flow

```
[1] bettrade-engine starts
    → Betfair login (existing)
    → overlap sync starts (existing, 30s interval)
    → ScalpyEngine.start() called

[2] Every 30s — ScalpyEngine identifies live matched fixtures
    → overlap list filtered: status === 'IN_PLAY' or market.inplay === true
    → For each live fixture: POST /api/feed/start/:id on geniusBackend (idempotent)
    → Initialise in-memory MatchState if not present

[3] Every 3s per live fixture — ScalpyEngine polls
    → GET /api/feed/{geniusId}/events?since={lastSeenTimestamp}
    → Process events in chronological order:
        goals              → increment totalGoals counter
        stoppageTimeAnnouncements → maybe trigger (see [4])
        phaseChanges       → update phase; detect FullTime → settlement

[4] stoppageTimeAnnouncements received
    → Guard: event.phase === 'SecondHalf'
    → Guard: state.bettingDone === false
    → Guard: event.timestamp > state.lastSeenTimestamp (dedupe)
    → Determine market: OVER_UNDER_{totalGoals}5
    → Fetch market from Betfair: betfairOuMarket.service.getMarket(eventId, marketType)
    → Run algorithm: scalpy.algorithm.decide({ addedMinutes, totalGoals, bestBackPrice, bestLayPrice })
    → If SKIP → log, set bettingDone=true, done
    → If BACK/LAY:
        DRY_RUN=true  → simulate, log, save to Supabase (status=PENDING, bet_id=null)
        DRY_RUN=false → betfair-orders.placeOrder(...) → save to Supabase (status=PENDING)
    → state.bettingDone = true
    → Emit SSE event to connected frontend clients

[5] phaseChanges → FullTime detected
    → ScalpyEngine notifies ScalpySettlement
    → ScalpySettlement resolves outcome (see Section 7)
```

---

## 4. Market Selection

| Total Goals at Trigger | Betfair marketTypeCode |
|---|---|
| 0 | OVER_UNDER_05 |
| 1 | OVER_UNDER_15 |
| 2 | OVER_UNDER_25 |
| 3 | OVER_UNDER_35 |
| 4 | OVER_UNDER_45 |
| 5+ | OVER_UNDER_55 |

Formula: `OVER_UNDER_${totalGoals}5`

The U/O market has exactly 2 runners:
- `"Under X.5 Goals"` → identified by `runnerName.toLowerCase().includes('under')`
- `"Over X.5 Goals"` → identified by `runnerName.toLowerCase().includes('over')`

The algorithm config specifies `selection: "UNDER" | "OVER"` to identify which runner to trade.

---

## 5. Algorithm Module

Config file: `bettrade-engine/scalpy-config.json` (user-editable at runtime)

```json
{
  "stake": 10,
  "currency": "GBP",
  "rules": [
    { "addedMinutes": 3, "selection": "UNDER", "side": "BACK", "price": 1.18 },
    { "addedMinutes": 4, "selection": "UNDER", "side": "BACK", "price": 1.22 },
    { "addedMinutes": 5, "selection": "UNDER", "side": "LAY",  "price": 1.21 },
    { "addedMinutes": 6, "selection": "UNDER", "side": "BACK", "price": 1.25 }
  ]
}
```

`scalpy.algorithm.decide()` logic:
1. Find matching rule by `addedMinutes` (exact match)
2. If no matching rule → `{ action: 'SKIP', reason: 'no_rule_for_added_minutes' }`
3. Check price viability:
   - BACK: if `bestBackPrice < rule.price` → SKIP (can't get requested price)
   - LAY: if `bestLayPrice > rule.price` → SKIP (can't lay at requested price)
4. If viable → `{ action: rule.side, selection: rule.selection, price: rule.price, reason: 'rule_matched' }`

---

## 6. Supabase Schema

### `scalpy_trades`

```sql
CREATE TABLE scalpy_trades (
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
```

### `scalpy_match_states`

```sql
CREATE TABLE scalpy_match_states (
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

---

## 7. Settlement

**DRY_RUN settlement:**  
When `phaseChanges → FullTime`, ScalpySettlement reads the final total goals from the match state. It determines outcome:
- BACK UNDER X.5: WON if finalTotalGoals <= X, LOST if > X
- LAY UNDER X.5: WON if finalTotalGoals > X, LOST if <= X
- BACK OVER X.5: WON if finalTotalGoals > X, LOST if <= X
- LAY OVER X.5: WON if finalTotalGoals <= X, LOST if > X

P&L for DRY_RUN:
- BACK WON: `stake * (price - 1)`
- BACK LOST: `-stake`
- LAY WON: `stake` (liability collected)
- LAY LOST: `-stake * (price - 1)` (liability paid)

**Live settlement (DRY_RUN=false):**  
Polls Betfair `listCurrentOrders` every 60s for PENDING trades until status is EXECUTION_COMPLETE.

---

## 8. API Endpoints (bettrade-engine additions)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/scalpy/stream` | SSE — live match states + bet events |
| GET | `/api/scalpy/trades` | Trade history (`?limit`, `?dry_run`, `?status`) |
| GET | `/api/scalpy/trades/:id` | Single trade detail |
| GET | `/api/scalpy/summary` | P&L summary (total, today, win rate, count) |
| POST | `/api/scalpy/config` | Reload scalpy-config.json at runtime |

### geniusBackend addition

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/feed/:id/events` | Returns flat event array from buffer, filtered by `?since=<ISO>` |

---

## 9. Frontend — `/scalpy` Dashboard

**Live Panel** (SSE-driven, auto-updates):
- One card per tracked fixture showing: teams, total goals, phase, target market, best back/lay prices, Scalpy status (WATCHING / BET PLACED / SKIPPED / DRY RUN badge)

**Trade History Panel**:
- Filterable table: date, match, market, selection, side, requested price, matched price, outcome, P&L
- Summary row: total bets, win rate, total P&L

---

## 10. New Environment Variables (bettrade-engine)

```env
# Supabase (same credentials as geniusBackend)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Scalpy mode
SCALPY_DRY_RUN=true

# Feed polling interval in ms (default: 3000)
SCALPY_FEED_POLL_MS=3000
```

---

## 11. Safety Mechanisms

| Mechanism | Implementation |
|---|---|
| One bet per match | `state.bettingDone = true` after any BACK/LAY/SKIP decision |
| Second Half only | `event.phase === 'SecondHalf'` guard |
| Price check | Algorithm skips if current market price is worse than config price |
| DRY_RUN default | `SCALPY_DRY_RUN=true` — requires explicit opt-in for live trading |
| No unmatched fixtures | Only fixtures in the overlap store are tracked |
| Event deduplication | `event.timestamp > state.lastSeenTimestamp` guard |

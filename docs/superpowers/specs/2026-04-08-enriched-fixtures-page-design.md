# Enriched Fixtures Page — Design Spec

**Date:** 2026-04-08  
**Status:** Approved  
**Scope:** Backend (bettrade-engine) + Frontend (bettrade)

---

## Goal

Enhance the existing `/fixtures` page to display rich Betfair exchange data alongside each overlapped fixture. The engine already matches Betfair markets with Genius Sports fixtures; this work adds live odds, volume, competition, and market metadata to each fixture.

---

## Architecture

**Approach:** Single enriched endpoint. The engine fetches Betfair market data during its polling cycle and serves combined data from the existing overlap endpoint.

**Data flow:**
1. Engine polls: fetch Betfair fixtures + Genius fixtures -> overlap match (existing)
2. Engine enriches: call `listMarketBook` + `listMarketCatalogue` for matched market IDs -> merge into cached data (new)
3. Frontend fetches: server-side `GET /api/v1/fixtures/overlap` -> renders enriched table (enhanced)

**Refresh cadence:** ISR with 60-second revalidation (existing pattern). Real-time streaming deferred to future work.

---

## Backend Changes (bettrade-engine)

### New Service: `betfair-market.service.js`

Responsible for fetching live market data from Betfair Exchange API.

#### `fetchMarketBooks(marketIds: string[]): Promise<MarketBook[]>`

Calls `listMarketBook` in batches to stay within the 200-point data limit.

**Betfair API call:**
```
POST https://api.betfair.com/exchange/betting/rest/v1.0/listMarketBook/
{
  "marketIds": [...batch of market IDs...],
  "priceProjection": {
    "priceData": ["EX_BEST_OFFERS", "EX_TRADED_VOL"],
    "exBestOffersOverrides": { "bestPricesDepth": 3 }
  },
  "matchProjection": "ROLLED_UP_BY_PRICE"
}
```

**Batching:** Each market with `EX_BEST_OFFERS` costs ~5 weight points. Max 200 points per request. Batch size = floor(200 / 5) = **40 markets per request**.

**Data extracted per market:**
- `marketId`
- `status` (OPEN, SUSPENDED, CLOSED)
- `inplay` (boolean)
- `totalMatched` (total volume in GBP)
- Per runner: `selectionId`, `runnerName`, `lastPriceTraded`, `totalMatched`, `ex.availableToBack[0..2]`, `ex.availableToLay[0..2]`

#### `fetchCompetitions(marketIds: string[]): Promise<Map<string, string>>`

Calls `listMarketCatalogue` with `COMPETITION` projection to get competition names for each market. This can be done alongside the existing `listMarketCatalogue` call in `betfair-fixtures.service.js` by adding `COMPETITION` to the projections.

**Simpler alternative:** Modify the existing `fetchBetfairFixtures()` to also include `COMPETITION` in its `marketProjection`, avoiding a separate API call. The competition name would then flow through the overlap matching.

**Decision:** Modify existing `fetchBetfairFixtures()` to include `COMPETITION` projection (zero-weight addition per the API docs).

### Modified Service: `overlap.service.js`

#### Enhanced `syncOnce()` flow:

1. Fetch Betfair fixtures (with competition) + Genius fixtures in parallel (existing, modified)
2. Run overlap matching (existing)
3. Fetch `listMarketBook` for all matched market IDs in batches (new)
4. Merge market book data into each overlapped fixture (new)
5. Cache enriched result (existing pattern)

#### Runner name mapping:

Betfair returns runners by `selectionId`, not by label. For MATCH_ODDS markets, the standard mapping is:
- Runner at index 0 → Home
- Runner at index 1 → Away
- Runner at index 2 → The Draw

The runner names come from `listMarketCatalogue` (already fetched). We map by matching runner names to fixture home/away team names, with "The Draw" as the draw runner.

### Enhanced Response Shape

```typescript
interface EnrichedFixture {
  // Existing fields (unchanged)
  matchId: string
  geniusId: string
  betfairEventId: string
  betfairMarketId: string
  homeTeam: string
  awayTeam: string
  startTime: string
  status: string
  similarityScore: number

  // New Betfair market data
  market: {
    status: string              // 'OPEN' | 'SUSPENDED' | 'CLOSED'
    inplay: boolean
    totalMatched: number        // total volume in GBP
    competition: string | null  // e.g. "English Premier League"
    runners: Array<{
      name: string              // team name or 'The Draw'
      selectionId: number
      lastPriceTraded: number | null
      totalMatched: number
      back: Array<{ price: number, size: number }>  // best 3 levels
      lay: Array<{ price: number, size: number }>    // best 3 levels
    }>
  } | null  // null if market book fetch failed for this market
}
```

The top-level response shape stays the same:
```typescript
{
  ok: boolean,
  count: number,
  lastUpdated: string | null,
  fixtures: EnrichedFixture[]
}
```

### Error Handling

- If `listMarketBook` fails for a batch, the fixtures in that batch get `market: null`
- If `listMarketBook` returns a market with `status: CLOSED`, it's still included (useful info)
- If the entire enrichment step fails, fall back to returning fixtures without market data (graceful degradation)

---

## Frontend Changes (bettrade)

### Updated Types in `app/fixtures/page.tsx`

Add the `market` field to the existing `OverlappedFixture` interface to match the enriched response.

### Updated `components/fixtures-table.tsx`

#### Row Layout (compact card)

Each fixture renders as a card row:

```
┌──────────────────────────────────────────────────────────────────┐
│  ● LIVE   Premier League                       Vol: £1,234,567  │
│                                                                  │
│  Manchester United  vs  Liverpool                                │
│  14:30 UTC  ·  Match Score: 92%                                 │
│                                                                  │
│  ┌────────────┬────────────┬────────────┐                       │
│  │   Home     │   Draw     │   Away     │                       │
│  │  B: 2.10  │  B: 3.40  │  B: 4.20  │                       │
│  │  L: 2.12  │  L: 3.50  │  L: 4.30  │                       │
│  └────────────┴────────────┴────────────┘                       │
│                                            ▼ More Details        │
└──────────────────────────────────────────────────────────────────┘
```

#### Expandable Detail Panel

Clicking "More Details" reveals:
- Market status (OPEN/SUSPENDED/CLOSED)
- Per-runner breakdown: last traded price, total matched, full 3-deep back/lay ladder
- Betfair Market ID, Event ID, Genius ID
- Similarity score breakdown

#### Styling

Consistent with existing dark theme:
- **Back prices:** sky/blue tint (`sky-500/600` background)
- **Lay prices:** rose/pink tint (`rose-500/600` background)
- **In-play badge:** emerald (matches current live indicator)
- **Suspended market:** amber warning
- **Volume:** formatted with `£` prefix, comma separators (e.g., `£1,234,567`)
- **Odds:** displayed to 2 decimal places

#### Filter Tabs

Keep existing: ALL | Live (IN_PLAY) | Upcoming (PREMATCH)

The "Live" filter now also checks `market.inplay === true` from Betfair data (more reliable than Genius status alone).

#### Empty/Loading States

- If `market` is `null` for a fixture, show the row with a "Market data unavailable" note where the odds grid would be
- Existing empty state (no fixtures) unchanged

### No New Dependencies

All UI built with Tailwind utility classes. No new packages needed.

---

## Files Changed

### Backend (bettrade-engine)
| File | Change |
|------|--------|
| `src/services/betfair-market.service.js` | **NEW** — fetchMarketBooks() with batching |
| `src/services/betfair-fixtures.service.js` | Add `COMPETITION` to market projections, include competition in return data |
| `src/services/overlap.service.js` | Call betfair-market after overlap match, merge market data into fixtures |

### Frontend (bettrade)
| File | Change |
|------|--------|
| `app/fixtures/page.tsx` | Update types to include `market` field |
| `components/fixtures-table.tsx` | New card layout, odds grid, expandable details |

---

## Out of Scope

- Real-time streaming (WebSocket/SSE) — deferred to future work
- Bet placement UI — not part of this spec
- Historical odds/price charts — not part of this spec
- Multiple market types (only MATCH_ODDS for now)

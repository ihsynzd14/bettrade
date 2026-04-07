# Bettrade Engine — Design Spec

**Date:** 2026-04-02  
**Status:** DRAFT  
**Project:** Bettrade Engine (Sub-project 1)  

---

## 1. Architecture Overview
`bettrade-engine` is a standalone Node.js/Express microservice. It serves as the brain for the automated trading bot, starting with its first capability: **The Overlap Engine**. 

It pulls real soccer fixtures from both `geniusBackend` and the Betfair API, maps them together using a smart name-matching algorithm, and holds the result in memory to serve the Next.js frontend instantly without hitting Betfair API limits.

---

## 2. Core Responsibilities

1. **Betfair Authentication:** Manage session tokens using the non-interactive bot login (SSL cert) documented in `BETFAIR-API-DOCS.md`.
2. **Genius Ingestion:** Fetch the list of live and upcoming fixtures from the existing `geniusBackend` REST API.
3. **Betfair Ingestion:** Fetch the list of Soccer events and 'Match Odds' markets from the Betfair REST API (`listEvents` / `listMarketCatalogue`).
4. **Overlap Matching:** Run an intelligent string-similarity algorithm to pair Genius matches with Betfair markets.
5. **State Serving:** Expose a fast `/api/v1/fixtures/overlap` endpoint for the frontend.

---

## 3. The Overlap Algorithm (How it works)
Team names differ wildly between providers (e.g., "Man Utd" vs "Manchester United", "1. FC Koln" vs "FC Cologne"). 

The engine will:
1. **Filter by Time:** Only compare matches starting within +/- 1 hour of each other.
2. **Normalize Strings:** Strip common suffixes/prefixes like "FC", "CF", "United", "City", "Real", and convert to lowercase.
3. **Calculate Similarity:** Use the **Dice Coefficient** or **Jaro-Winkler** algorithm to score the similarity between the Home teams and Away teams.
4. **Threshold:** If the combined similarity score is > 85%, mark them as an "Overlapped Fixture".

---

## 4. State Management (The "No Cache" Approach)
To provide the best user experience (instant page loads) while protecting Betfair API limits:
- The engine runs an **internal background loop** every 60 seconds.
- It fetches fresh lists, runs the overlap algorithm, and updates an **in-memory Javascript object** (`let overlappedFixtures = [...]`).
- When the frontend requests `/api/v1/fixtures/overlap`, it reads directly from this variable.
- There is **no Redis, no database, no caching layer to manage or invalidate**. If the server restarts, state is rebuilt instantly on boot.

---

## 5. Technical Stack
- **Runtime:** Node.js v20+
- **Framework:** Express.js
- **Dependencies:** 
  - `axios` (API fetching)
  - `string-similarity` (Overlap matching)
  - `https` / `fs` (Betfair SSL cert auth)
  - `cors`, `dotenv`

---

## 6. Output Data Structure
The API will return a clean JSON array combining both IDs:

```json
[
  {
    "matchId": "betfair_event_123_genius_456",
    "geniusId": "456",
    "betfairEventId": "123",
    "betfairMarketId": "1.123456789",
    "homeTeam": "Manchester United",
    "awayTeam": "Chelsea",
    "startTime": "2026-04-02T15:00:00Z",
    "status": "IN_PLAY",
    "similarityScore": 0.92
  }
]
```
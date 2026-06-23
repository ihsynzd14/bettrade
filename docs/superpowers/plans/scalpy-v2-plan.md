# Scalpy v2 — Implementation Plan (FINAL, operator-approved decisions)

Status: **Approved for build, decisions locked.** This is a plan/spec — implementation happens phase-by-phase, all in DRY_RUN until the final live-arming phase.

Repos: engine = `bettrade-engine/` (Node/Express, :4001, binds 0.0.0.0, polls a **remote** geniusBackend feed via `GENIUS_BACKEND_URL`), frontend = `bettrade/` (Next.js, :4000), Supabase (`scalpy_trades`, `scalpy_match_states`, + new control tables).

---

## 0. Locked decisions (operator-confirmed)

| Topic | Decision |
|---|---|
| **Stake** | **£2 per bet** — enforced as a hard cap (`maxStakeHardCap: 2`), not just a default |
| **Daily loss auto-kill** | **£20 realized loss/day** (= 10× stake) → engine auto-kills; **resume requires manual acknowledgment** (never auto-clears at midnight) |
| **Max total open liability** | **£20** (set equal to the daily loss limit → worst-case overshoot floor = 2× = £40) |
| **Bets per day** | **Unlimited** (no count cap — don't miss opportunities). Protection rests on the £20 loss-limit + £20 open-liability + kill-switch |
| **Stoppage estimate (Live Fixtures)** | **Announced minutes only** (v1). `SCALPY_STOPPAGE_MODE='announced'`; predictor wired as a later flag-flip |
| **Tick adjustment stacking** | **Take the max, not additive** (`stackAdjustments: false`). E.g. 4-0 AND a team down 2 → **+5 ticks** (the larger), not +8 |
| **Side / runner** | BACK the **UNDER** runner on the current-goal-count market only (never OVER, never LAY) — unchanged from baseline |
| **Daily reset** | **Date-filter, NEVER delete** rows. Scalpy tab shows the current **Europe/Istanbul (UTC+3)** day's placed bets |
| **Live-data refresh** | **As fast as safe**: odds poller self-scheduling + batched + change-only + adaptive backoff, default **3s**; minute/score already ~3s via the event poll (see §3b) |
| **FT removal** | Engine `clearState` on confirmed finalize, with a `finalizedToday` guard against re-bet on a flapping inplay flag |
| **`/fixtures` (old overlap view)** | Retire (Live Fixtures supersedes it) |
| **Circuit breaker** | N consecutive losses → **soft-pause + alert + manual resume** (don't hard-kill the day) |
| **Admin auth** | Shared-secret header `X-Scalpy-Admin: <SCALPY_ADMIN_TOKEN>` on all mutating routes (ship-blocker for live) |

> **HARD RULE:** `SCALPY_DRY_RUN=false` is **forbidden until Phase 1 (safety brakes) ships and passes**. Live arming additionally requires `SCALPY_LIVE_CONFIRM=I_UNDERSTAND` **and** a non-killed control row.

---

## 1. Requirement recap (what we're building)

**A. Tab restructure**
- **Scalpy tab** = ONLY matches we actually placed a bet on (source: Supabase trade rows, `status != SKIPPED`). Today's Istanbul day; resets at 00:00 (date-filter, not delete). "Today's P&L" at top.
- **Live Fixtures tab** = ALL currently live-tracked matches (source: in-memory match-states over SSE). A match **disappears at FULL TIME**.

**B. Live Fixtures per-match data**
- Match name, **League** (Betfair competition), minute, score, **announced stoppage**, and for the **current-score U/O market**: **BBP / BLP / LTP** of the UNDER runner (2-1 = 3 goals → Under 3.5 book).
- Per-card **manual watch toggle**: 👁 (watching, default ON) + ✕ (unwatch → stop polling + stop betting for that match but keep it in the list); 👁 resumes.
- Refresh as fast as safely possible (see §3b).

**C. Betting algorithm v1**
- On the 2nd-half added-time announcement, BACK UNDER priced by announced minutes: **1→1.06, 2→1.12, 3→1.18, 4→1.23, 5→1.28, 6→1.35, 7→1.42**. **>7 min → nothing.** Stake £2.
- Before sending: **no active risk** (Dangerous Attack, pending Corner, VAR/Penalty risk). If active → **defer**, retry each poll, send when clear (recompute against current score).
- **Goal-diff ≥ 4** (e.g. 4-0, 6-1, 8-3) → **+3 ticks**. Real Betfair tick ladder. 4-0 @ 3min → **1.21**.
- **Team down 2 players** → **+5 ticks**. **Team down 3 or 4** → **don't bet**. Adjustments take the **max** (not additive).

**D. Safety brakes (highest priority)**
- One bet per market (toggle), liability cap per market, daily loss auto-kill, total open-liability cap, kill-switch + admin panel, dedupe/idempotency, etc. (full set in §3d).

---

## 2. Target architecture

```
                  ┌──────────────────── ENGINE (bettrade-engine, :4001) ────────────────────┐
Genius feed ─▶ pollEvents(~3s) ─▶ processEvent ─▶ match-state (in-memory, by geniusId)        │
 GET /feed/:id        │               │            score/minute/phase                         │
                      │               │            redCards, activeRisk, competition (NEW)     │
                      │               │            watching, estimatedStoppage, ouBook (NEW)   │
                      │               ▼                                                        │
                      │       handleStoppageTime ─▶ decide() ─▶ canPlaceBet() GATE ─▶ placeOrder│
                      │        (defer if risk)      (ladder+ticks)  (15 brakes, fail-closed)    │
Betfair REST ◀─ price-poller (NEW: self-scheduling ~3s, batched, watched+live only) ─▶ ouBook  │
 listMarketBook                                                  claim-before-place ─▶ Supabase │
                  SSE /api/scalpy/stream ◀── broadcast(...)                                     │
                  REST /api/scalpy/{trades,trades/today,summary,control,watch,config,log}       │
                  └────────────────────────────────────────────────────────────────────────────┘
                              │ SSE: match_states, goal, ou_book, watch_toggled, bet_*, control_changed
        ┌─────────────────────┴──────────────── FRONTEND (bettrade, :4000) ─────────────────────┐
        │ /live-fixtures ── useScalpyStream ── ALL tracked, hides FullTime ── card w/ 👁/✕        │
        │ /scalpy        ── server fetch /trades/today + summary ── bet rows only ── DailyRollover│
        │ /admin         ── KILL-SWITCH + DRY/LIVE badge + P&L vs limit + bet-rate + decision log │
        └────────────────────────────────────────────────────────────────────────────────────────┘
```

Principles: **Live Fixtures = ephemeral SSE state** (dies at FT). **Scalpy tab = durable Supabase rows** (survives FT + restart). One SSE channel reused for everything. **One placement choke point** (`handleStoppageTime → canPlaceBet → placeOrder`). Kill-switch = one authoritative `scalpy_control` row mirrored to an O(1) in-memory cache.

---

## 3. Feature designs

### 3a. Tab restructure & daily reset (A)
- Move the SSE live panel `app/scalpy/live-panel.tsx` → `app/live-fixtures/live-panel.tsx` (`LiveFixturesPanel`), render `matchStates` unfiltered, **hide `phase==='FullTime'`**.
- `app/live-fixtures/page.tsx` (NEW) hosts it; nav `/fixtures` → `/live-fixtures`; retire old `/fixtures`.
- `app/scalpy/page.tsx`: fetch `/api/scalpy/trades/today` (not `/trades?limit=100`); drop the live panel; keep `ScalpySummaryBar` (now Istanbul-correct) + `ScalpyTradesTable`; add `<DailyRollover/>` (client timer → `router.refresh()` at Istanbul midnight; re-arm on `visibilitychange`/`focus`).
- **FT removal (durable):** engine calls `clearState(geniusId)` after settlement **only when the fixture is confirmed gone from the overlap**; `initState` refuses to recreate a geniusId that already has a settled trade / FullTime today (`finalizedToday` Set) → a flapping `inplay` flag can't reset `bettingDone` and re-bet.
- **Daily reset = date-filter:** `trade.repository.js` gets `startOfLocalDayUtc('Europe/Istanbul')` (shared with brakes), `getTradesForDay({placedOnly:true})` = `created_at >= boundary AND status != 'SKIPPED'`, and **fix `getSummary()`** (today is currently computed in UTC). Boundary computed at request time → window auto-advances without a cron. `totalPnl` stays all-time. Group by **placement day** (`created_at`).

### 3b. Live Fixtures enrichment + 👁/✕ + odds pipeline (B)  ← includes the new refresh-rate requirement
- **MatchState additions:** `competition` (from `fixture.market?.competition`), `watching` (default true), `estimatedStoppage`, `ouBook = {marketId, marketType, threshold, underSelectionId, bbp, blp, ltp, status, updatedTs}`. Mutators `setWatching/setOuBook/setEstimatedStoppage`.
- **Odds pipeline (`scalpy/scalpy.price-poller.js`, NEW)** — tuned for "fast but never strains the server":
  - **Self-scheduling** (`setTimeout` after each run completes, NOT a fixed `setInterval`) → a slow Betfair response never causes overlapping requests. Default `SCALPY_OU_POLL_MS=3000` (≈3s).
  - **Batched:** one `listMarketBook` request covers up to 40 markets (existing `fetchMarketBooks` already batches + already returns `lastPriceTraded` = LTP). ~25-40 live markets ⇒ 1 request / 3s ≈ 20 req/min — trivial for the server, far under Betfair limits.
  - **Filter:** only `watching && phase!=='FullTime' && betfairEventId` markets are polled.
  - **Market resolution cache:** `resolveOuMarketId(eventId, marketType)` (catalogue-only, cached by `eventId:marketType`) → 1 catalogue call per (event, score); a goal changes the key → one extra call.
  - **Change-only SSE:** broadcast `{type:'ou_book', geniusId, data}` **only when prices change** → no SSE/CPU spam.
  - **Adaptive backoff:** on Betfair error/rate-limit (`TOO_MUCH_DATA`, throttle, etc.), automatically multiply the interval (×2 up to a cap, e.g. 12s) and recover when healthy → self-protecting; the server can never be "killed" by this loop.
  - Minute/score/phase already arrive every ~3s via `pollEvents` and push to the UI on change — so the whole card is effectively real-time at ~3s, with the safety valves above. Both intervals are env-configurable.
- **Stoppage estimate:** v1 = echo `event.addedMinutes` (announced). Label "Added (announced)". Cheap event counters (goals/subs/VAR/cards) are incremented now so a future predictor is a flag-flip (`SCALPY_STOPPAGE_MODE`).
- **👁/✕ unwatch:** `POST /api/scalpy/watch/:geniusId {watching}` → `setWatching` + broadcast `watch_toggled`. Effects: price-poller self-filters; `pollEvents` early-returns when `!watching` (interval no-ops, instant resume); `handleStoppageTime` skips with `bet_skipped:unwatched`; never removed from list; still finalizes at FT. **Re-watch gap guard:** while unwatched, still advance `lastSeenTs`/mark events seen so re-watch can't replay a stale stoppage → late bet. Frontend `fixture-card-with-watch.tsx` (NEW): optimistic toggle, SSE reconciles. Persistence: in-memory only (resets to watching on reboot).

### 3c. Betting algorithm v1 (C)
- **`scalpy.ticks.js` (NEW)** — real Betfair tick ladder via integer-cents (0.01 <2, 0.02 to 3, 0.05 to 4, 0.1 to 6, 0.2 to 10, 0.5 to 20, 1 to 30, 2 to 50, 5 to 100, 10 to 1000). `addTicks(price,n)` / `snapToTick` / `clampPrice`. **"+N ticks" must walk the ladder, never `price+0.0N`.**
- **`scalpy-config.json` (NEW shape):**
  ```jsonc
  { "stake":2, "currency":"GBP", "side":"BACK", "selection":"UNDER", "maxStakeHardCap":2,
    "ladder":{"1":1.06,"2":1.12,"3":1.18,"4":1.23,"5":1.28,"6":1.35,"7":1.42}, "maxAddedMinutes":7,
    "adjustments":{"goalDiffTicks":3,"goalDiffThreshold":4,"redCard2Ticks":5,"redCardSkipFrom":3,"stackAdjustments":false},
    "priceBounds":{"min":1.01,"max":2.0}, "brakes":{ /* §3d */ } }
  ```
- **`decide({addedMinutes, totalGoals, goalDiff, maxRedCards, bestBackUnder})`:** redCards ≥ 3 → SKIP; addedMinutes >7 or no ladder entry → SKIP; base = ladder; `ticks = stackAdjustments ? (goalDiff>=4?3:0)+(maxRedCards===2?5:0) : max(goalDiff>=4?3:0, maxRedCards===2?5:0)`; `price = clampPrice(addTicks(base, ticks), bounds)`. **stacking = max** (locked). Worked: 4-0@3min → addTicks(1.18,3)=**1.21**; 6-1 & down-2 @4min → max(3,5)=5 → addTicks(1.23,5)=**1.28**.
- **Risk-defer:** `handleStoppageTime` decides from state (no market call yet); if any risk flag active → store `pendingBet`, broadcast `bet_deferred`, **do NOT set `bettingDone`**. Each `pollEvents` calls `tryPendingBet`: re-check risk; on clear → `placeScalpyBet` (recompute against current score/cards). Expire on leaving SecondHalf / `finalizeFixture` / ~10min cap. A revised announcement overwrites `pendingBet.addedMinutes` while still deferred.
- **Risk flags (in `processEvent`):** `redCards[team]++` on `straightRedCards`+`secondYellowCards` (confirmed, raw `event.team`, **no own-goal flip**); `dangerousAttack` from `dangerStateChanges` (`*DangerousAttack`); `pendingCorner` from `cornersV2` (awarded&confirmed & not taken); `varInReview` (`varState==='InReview'`); `penaltyRisk` (`penaltyRiskChanges`). **Corner dedupe fix (REQUIRED):** key cornersV2 on `${type}:${id}:${takenConfirmed}` else the "taken" update is dropped → infinite defer. **Per-flag TTL:** a flag true >X s with no fresh event is auto-cleared (catches a missed "clear").

### 3d. Safety brakes & admin panel (D) — most detailed
**Data model:** `scalpy_control` (single row): `killed, kill_reason, killed_at, killed_by, tracking_paused, trading_day, realized_pnl_today, consecutive_losses, updated_at`. `scalpy_trades`: ADD `dedupe_key` + partial unique index, ADD `CLAIMED` status, persist `matched_size/order_status`. `scalpy_decisions` (optional): append-only log for the panel.

**`brakes` config (locked values):**
```jsonc
"brakes":{ "oneBetPerMarket":true, "maxLiabilityPerMarket":2,
  "maxTotalOpenLiability":20, "maxBetsPerDay":null /* unlimited */,
  "dailyRealizedLossLimit":20, "circuitBreakerLosses":5 /* soft-pause */,
  "priceMin":1.01, "priceMax":2.0, "requireBookPresent":true,
  "requireMarketOpen":true, "maxBookSlipTicks":5, "minSimilarityScore":0.75 }
```

**Placement path (single choke point, `scalpy.brakes.js`, fail-closed):**
```
placeScalpyBet(geniusId, addedMinutes):
  0. SYNC MUTEX placing.has(geniusId)? return : add()   [finally delete]
  1. snapshot: goalsAtDecision, redCards, cfg=getConfig() ONCE
  2. recompute decide() vs CURRENT state; SKIP → broadcast+return
  --- canPlaceBet GATE (cheap/decisive first) ---
   1 KILL-SWITCH       control.killed → BLOCK
   2 LIVE GUARD        live ⇒ SCALPY_LIVE_CONFIRM=I_UNDERSTAND (boot-cached)
   3 PRICE+BOOK SANITY price on ladder & in bounds; book present; status OPEN; |bestBackUnder−price| ≤ maxBookSlipTicks
   4 RUNNER SANITY     2 runners; under≠over; under name contains threshold
   5 MAPPING CONF      similarityScore ≥ 0.75; resolved teams match
   6 FEED FRESHNESS    now−lastEventTs ≤ STALE_MS (~30s)
   7 SCORE UNCHANGED   totalGoals===goalsAtDecision AND marketType===goalCountToMarketType(now)   ← highest value
   8 ONE-BET/MARKET    no row for this market in (CLAIMED,PENDING,MATCHED,SETTLED)
   9 LIABILITY/MARKET  liability(side,stake,price) ≤ 2
  10 TOTAL OPEN LIAB   openLiability + this ≤ 20
  11 DAILY LOSS        realized_pnl_today > −20  else BLOCK + AUTO-KILL(daily_loss)
  12 CIRCUIT BREAKER   consecutive_losses < 5    else soft-pause + alert
  13 STAKE HARD CAP    stake ≤ 2
  --- end gate ---
  3. CLAIM-BEFORE-PLACE: insert row status='CLAIMED', dedupe_key='scalpy:'+geniusId+':'+marketId,
       customerRef=dedupe_key; unique-violation ⇒ already claimed ⇒ abort, NO order.
  4. RE-CHECK control.killed immediately before placeOrder.
  5. placeOrder; CLAIMED→PENDING, store bet_id/matchedSize/status.
  6. broadcast bet_placed; setBetPlaced(geniusId, tradeId).
  [finally] placing.delete(geniusId)
```
(No `maxBetsPerDay` gate — unlimited, per decision. Daily bound = the £20 loss-limit + £20 open-liability + kill-switch.)

**Concurrency (mandatory before live):** per-fixture sync `Set` mutexes `placing/settling/pollInFlight/finalizing` (claim/release with no `await` between check+set). Replace `setInterval(pollEvents)` with self-scheduling `setTimeout` (or `pollInFlight` guard). Deterministic `customerRef = dedupe_key` (not `Date.now()`). **Startup rehydration:** before `startEngine()`, load `scalpy_control` + open `scalpy_trades`, set `bettingDone=true` for any fixture with a non-skipped row.

**Idempotent settlement:** conditional `update … where id=$1 and status!='SETTLED'`; only on `rowCount===1` fire SSE + accumulate control (`realized_pnl_today`, `consecutive_losses`). Compute `realized_pnl_today` as `sum(pnl) where SETTLED today` on read (avoid drift). Auto-kill on loss-limit; soft-pause on circuit. DRY_RUN settlement self-heal sweep. Settle against authoritative final score (final drain before reading `totalGoals`).

**Kill-switch:** in-memory + persisted; read on hot path AND re-read just before `placeOrder`; atomic monotonic (resume mustn't clobber an auto-kill); one authoritative source. Live kill best-effort `cancelOrders`. **Auto-kill requires manual ack to resume** (locked).

**Bounded-loss guarantee (with unlimited count):** since there's no count cap, the day is bounded by `dailyRealizedLossLimit (£20)` + in-flight overshoot `≤ maxTotalOpenLiability (£20)` → realistic worst-case ≈ **£40 floor**, plus the always-available kill-switch. Weakness: the loss-limit is settlement-latency-coupled (if settlement stalls it trips late) — mitigated by the £20 open-liability cap + one-bet-per-market + the panel's "time since last settlement" alarm.

**Admin endpoints:** `POST /control {action,pauseTracking?,reason?}`, `GET /control` (status + openLiability + effective brakes + dryRun/liveArmed), `GET /log?limit`, extended `POST /config` (validate brakes, clamp stake, atomic temp-write+rename), shared-secret auth on all mutating routes.

**Admin panel (`app/admin/page.tsx`, NEW)** — ordered so a human catches a runaway in seconds: (1) big KILL-SWITCH (auto-kill needs confirm-to-resume) + "also pause tracking"; (2) **DRY/LIVE badge** (loudest); (3) today P&L vs £20 limit bar; (4) open liability + unsettled count + **time since last settlement**; (5) **bet-rate (5/15 min)** runaway detector; (6) last-N decisions (PLACED/SKIPPED/BLOCKED); (7) consecutive-losses; (8) poll `/control` every 2-5s independent of SSE.

---

## 4. Data model & API changes
- **Supabase:** `scalpy_control` (NEW); `scalpy_trades` (+`dedupe_key`+unique index, +`CLAIMED`, persist matched/order status); `scalpy_decisions` (NEW, optional).
- **REST (NEW):** `GET /trades/today`, `POST /watch/:id`, `POST /control`, `GET /control`, `GET /log`, extended `POST /config` + `GET /config`.
- **SSE (NEW types):** `ou_book`, `watch_toggled`, `bet_deferred`, `bet_blocked`, `control_changed`. `match_states` now carries `betPlaced, watching, competition, estimatedStoppage, ouBook`.
- **Env (NEW):** `SCALPY_OU_POLL_MS=3000`, `SCALPY_STOPPAGE_MODE=announced`, `SCALPY_LIVE_CONFIRM`, `SCALPY_ADMIN_TOKEN`, `SCALPY_STALE_MS`.

---

## 5. Phased rollout (safety first; all DRY_RUN until Phase 7)
- **Phase 0** — `scalpy-config.json` stake→2 + `maxStakeHardCap`; document live-forbidden. *(trivial, immediate)*
- **Phase 1 — SAFETY BRAKES core (load-bearing, FIRST):** `scalpy_control` + `loadControl()` before arming; `dedupe_key` + claim-before-place; per-fixture mutexes + self-scheduling poll; `canPlaceBet` gate; idempotent settlement + auto-kill; startup live-guard; boot-resolved `dryRun`; admin endpoints + auth + minimal panel (kill + state strip + bet-rate + log). Test: double-poll, kill mid-flight, restart mid-placement, score-changed-during-placement, counter persistence.
- **Phase 2** — Istanbul-day boundary + `getSummary` fix + `getTradesForDay` + `/trades/today`; `betPlaced/tradeId` on MatchState; `clearState` + `finalizedToday`.
- **Phase 3** — Tab UI: live-panel → `/live-fixtures`; `/scalpy` → today's rows; nav; `full_time` removal in hook; `DailyRollover`; retire `/fixtures`.
- **Phase 4** — Odds pipeline (`price-poller`, self-scheduling+batched+change-only+backoff) + `competition`/`estimatedStoppage` + rich card BBP/BLP/LTP.
- **Phase 5** — 👁/✕ unwatch (endpoint + guards + re-watch gap guard + optimistic card).
- **Phase 6** — Algorithm v1: `scalpy.ticks.js`; ladder config; `decide()` rewrite (max-stacking); risk flags + corner-dedupe fix + flag TTL; `pendingBet`/`tryPendingBet` defer.
- **Phase 7 — LIVE validation & arming (needs live):** only after 0-6 pass DRY_RUN. Verify idempotent claim/place vs real Betfair (partial fills, customerRef dedupe), real `book.status`/suspension, cleared-order settlement, kill cancels unmatched orders. Arm via two-flag guard with tiny limits; operator babysits via the panel; widen only after trust.

---

## 6. Minor defaults (chosen, no further input needed)
Group bets by **placement day** (`created_at`); league from **Betfair competition**; **UNDER-only** BBP/BLP/LTP on the card (OVER available for free if wanted later); watch flag **in-memory only**; timezone via `Intl`/`date-fns-tz` (Europe/Istanbul, fixed UTC+3); risk-defer timeout = leave-SecondHalf or ~10min cap; circuit breaker = soft-pause + manual resume.

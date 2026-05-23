// Match state as tracked by ScalpyEngine (in-memory)
export interface MatchState {
  geniusId: string
  homeTeam: string
  awayTeam: string
  betfairEventId: string
  betfairMarketId: string
  totalGoals: number
  phase: string | null
  bettingDone: boolean
  lastSeenTs: string | null
}

// A completed or pending trade row from Supabase
export interface ScalpyTrade {
  id: string
  bet_id: string | null
  dry_run: boolean
  genius_id: string
  betfair_event_id: string
  betfair_market_id: string
  selection_id: number
  home_team: string
  away_team: string
  total_goals: number
  added_minutes: number
  market_type: string        // e.g. "OVER_UNDER_25"
  selection: string          // "UNDER" | "OVER"
  side: 'BACK' | 'LAY'
  requested_price: number
  matched_price: number | null
  stake: number
  reason: string | null
  status: 'PENDING' | 'MATCHED' | 'SETTLED' | 'SKIPPED' | 'FAILED'
  outcome: 'WON' | 'LOST' | null
  pnl: number | null
  created_at: string
  settled_at: string | null
}

export interface ScalpySummary {
  total: number
  settled: number
  won: number
  lost: number
  winRate: number | null
  totalPnl: number
  todayPnl: number
}

export interface BetPlacedData {
  tradeId: string
  side: 'BACK' | 'LAY'
  selection: string
  price: number
  stake: number
  marketType: string
  addedMinutes: number
  dryRun: boolean
}

// SSE event types emitted by bettrade-engine
export type ScalpySSEEvent =
  | { type: 'match_states'; data: MatchState[] }
  | { type: 'goal'; geniusId: string; data: { totalGoals: number } }
  | { type: 'phase_change'; geniusId: string; data: { phase: string } }
  | { type: 'full_time'; geniusId: string }
  | { type: 'bet_placed'; geniusId: string; data: BetPlacedData }
  | { type: 'bet_skipped'; geniusId: string; data: { reason: string; addedMinutes?: number } }
  | { type: 'trade_settled'; data: { tradeId: string; outcome: string; pnl: number; dryRun: boolean } }
  | { type: 'error'; geniusId: string; data: { message: string } }

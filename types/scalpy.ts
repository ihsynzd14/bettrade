// Under/Over book snapshot for the current score (UNDER runner)
export interface OuBook {
  marketId: string
  marketType: string
  threshold: number
  underSelectionId: number
  status: string | null
  bbp: number | null // best back price
  blp: number | null // best lay price
  ltp: number | null // last traded price
}

// Match state as tracked by ScalpyEngine (in-memory)
export interface MatchState {
  geniusId: string
  homeTeam: string
  awayTeam: string
  betfairEventId: string
  betfairMarketId: string
  competition: string | null
  totalGoals: number
  homeGoals: number
  awayGoals: number
  phase: string | null
  currentMinute: string | null
  estimatedStoppage: number | null // predicted added time for the current phase, in SECONDS (card renders M:SS)
  watching: boolean
  ouBook: OuBook | null
  pendingBet: { addedMinutes: number } | null
  bettingDone: boolean
  betPlaced: boolean
  tradeId: string | null
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
  | { type: 'goal'; geniusId: string; data: { totalGoals: number; homeGoals: number; awayGoals: number } }
  | { type: 'phase_change'; geniusId: string; data: { phase: string } }
  | { type: 'full_time'; geniusId: string }
  | { type: 'bet_placed'; geniusId: string; data: BetPlacedData }
  | { type: 'bet_skipped'; geniusId: string; data: { reason: string; addedMinutes?: number } }
  | { type: 'bet_deferred'; geniusId: string; data: { addedMinutes: number; risks: string[] } }
  | { type: 'bet_blocked'; geniusId: string; data: { reason: string; brake?: string; detail?: string } }
  | { type: 'ou_book'; geniusId: string; data: OuBook }
  | { type: 'watch_toggled'; geniusId: string; data: { watching: boolean } }
  | { type: 'trade_matched'; data: { tradeId: string; matchedPrice: number | null } }
  | { type: 'trade_settled'; data: { tradeId: string; outcome: string; pnl: number; dryRun: boolean } }
  | { type: 'control_changed'; data: Record<string, unknown> }
  | { type: 'error'; geniusId: string; data: { message: string } }

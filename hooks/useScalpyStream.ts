'use client'

import { useEffect, useRef, useState } from 'react'
import type { MatchState, ScalpySSEEvent } from '@/types/scalpy'

interface ScalpyStreamState {
  matchStates: MatchState[]
  recentEvents: Array<{ ts: number; event: ScalpySSEEvent }>
  connected: boolean
}

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:4001'

export function useScalpyStream() {
  const [state, setState] = useState<ScalpyStreamState>({
    matchStates: [],
    recentEvents: [],
    connected: false,
  })

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource(`${ENGINE_URL}/api/scalpy/stream`)
    esRef.current = es

    es.onopen = () => setState(prev => ({ ...prev, connected: true }))

    es.onmessage = (e) => {
      try {
        const event: ScalpySSEEvent = JSON.parse(e.data)

        setState(prev => {
          let { matchStates } = prev

          switch (event.type) {
            case 'match_states':
              matchStates = event.data
              break
            case 'full_time':
              // Live Fixtures: the match disappears at full time.
              matchStates = matchStates.filter(s => s.geniusId !== event.geniusId)
              break
            case 'goal':
            case 'phase_change':
            case 'bet_placed':
            case 'ou_book':
            case 'watch_toggled': {
              const ev = event
              matchStates = matchStates.map(s => {
                if (s.geniusId !== ev.geniusId) return s
                switch (ev.type) {
                  case 'goal':
                    return { ...s, totalGoals: ev.data.totalGoals, homeGoals: ev.data.homeGoals, awayGoals: ev.data.awayGoals }
                  case 'phase_change':
                    return { ...s, phase: ev.data.phase }
                  case 'bet_placed':
                    return { ...s, bettingDone: true, betPlaced: true, tradeId: ev.data.tradeId }
                  case 'ou_book':
                    return { ...s, ouBook: ev.data }
                  case 'watch_toggled':
                    return { ...s, watching: ev.data.watching }
                  default:
                    return s
                }
              })
              break
            }
            default:
              break
          }

          const recentEvents = [{ ts: Date.now(), event }, ...prev.recentEvents].slice(0, 20)
          return { matchStates, recentEvents, connected: true }
        })
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => setState(prev => ({ ...prev, connected: false }))

    return () => es.close()
  }, [])

  return state
}

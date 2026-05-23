'use client'

import { useEffect, useRef, useState } from 'react'
import type { MatchState, ScalpySSEEvent, BetPlacedData } from '@/types/scalpy'

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

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true }))
    }

    es.onmessage = (e) => {
      try {
        const event: ScalpySSEEvent = JSON.parse(e.data)

        setState(prev => {
          let { matchStates } = prev

          if (event.type === 'match_states') {
            matchStates = event.data
          } else if (event.type === 'goal' || event.type === 'phase_change') {
            matchStates = matchStates.map(s => {
              if (s.geniusId !== event.geniusId) return s
              if (event.type === 'goal') return { ...s, totalGoals: event.data.totalGoals }
              if (event.type === 'phase_change') return { ...s, phase: event.data.phase }
              return s
            })
          } else if (event.type === 'bet_placed') {
            matchStates = matchStates.map(s =>
              s.geniusId === event.geniusId ? { ...s, bettingDone: true } : s
            )
          }

          const recentEvents = [
            { ts: Date.now(), event },
            ...prev.recentEvents,
          ].slice(0, 20)

          return { matchStates, recentEvents, connected: true }
        })
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false }))
    }

    return () => {
      es.close()
    }
  }, [])

  return state
}

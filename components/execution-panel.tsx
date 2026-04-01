'use client'

import { useEffect, useRef, useState } from 'react'

interface LogEntry {
  id: number
  time: string
  status: 'PLACED' | 'MATCHED' | 'PENDING' | 'SETTLED'
  match: string
  side: 'Back' | 'Lay'
  odds: string
  stake: string
}

const LOG_ENTRIES: LogEntry[] = [
  { id: 1, time: '14:32:07', status: 'MATCHED',  match: 'Man City vs Chelsea',  side: 'Back', odds: '1.85', stake: '£50'  },
  { id: 2, time: '14:32:11', status: 'PLACED',   match: 'Arsenal vs Liverpool', side: 'Lay',  odds: '2.10', stake: '£30'  },
  { id: 3, time: '14:32:19', status: 'SETTLED',  match: 'Real Madrid vs Barca', side: 'Back', odds: '1.62', stake: '£100' },
  { id: 4, time: '14:32:24', status: 'MATCHED',  match: 'PSG vs Bayern',        side: 'Back', odds: '2.40', stake: '£40'  },
  { id: 5, time: '14:32:31', status: 'PENDING',  match: 'Juventus vs Inter',    side: 'Lay',  odds: '1.95', stake: '£60'  },
  { id: 6, time: '14:32:38', status: 'PLACED',   match: 'Dortmund vs Leipzig',  side: 'Back', odds: '1.75', stake: '£80'  },
  { id: 7, time: '14:32:45', status: 'MATCHED',  match: 'Atletico vs Sevilla',  side: 'Lay',  odds: '3.20', stake: '£25'  },
  { id: 8, time: '14:32:52', status: 'SETTLED',  match: 'Porto vs Benfica',     side: 'Back', odds: '2.05', stake: '£45'  },
]

const STATUS_STYLES: Record<LogEntry['status'], string> = {
  PLACED:  'text-sky-400',
  MATCHED: 'text-emerald-400',
  PENDING: 'text-zinc-400',
  SETTLED: 'text-zinc-500',
}

export default function ExecutionPanel() {
  const [visible, setVisible] = useState<LogEntry[]>(LOG_ENTRIES.slice(0, 4))
  const [index, setIndex] = useState(4)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      const next = LOG_ENTRIES[index % LOG_ENTRIES.length]
      setVisible(prev => [...prev.slice(-6), { ...next, id: Date.now() }])
      setIndex(i => i + 1)
    }, 1800)
    return () => clearInterval(interval)
  }, [index])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visible])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
          Live Execution Monitor
        </span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-xs text-emerald-400">LIVE</span>
        </span>
      </div>

      {/* Log */}
      <div ref={scrollRef} className="h-48 overflow-y-auto px-4 py-2 space-y-1.5 scrollbar-none">
        {visible.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 text-xs font-mono"
            style={{ animation: 'fadeIn 0.6s ease forwards' }}
          >
            <span className="text-zinc-600 shrink-0 w-16">{entry.time}</span>
            <span className={`shrink-0 w-16 font-semibold ${STATUS_STYLES[entry.status]}`}>
              {entry.status}
            </span>
            <span className="text-zinc-300 truncate flex-1">{entry.match}</span>
            <span className="text-zinc-500 shrink-0">{entry.side}</span>
            <span className="text-sky-400 shrink-0 w-10 text-right">{entry.odds}</span>
            <span className="text-zinc-300 shrink-0 w-10 text-right">{entry.stake}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-t border-zinc-800">
        {[
          { label: 'Trades Today', value: '142'   },
          { label: 'Win Rate',     value: '68%'   },
          { label: 'Avg Latency',  value: '218ms' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-r-0"
          >
            <span className="font-sans font-semibold text-sm text-zinc-50">{stat.value}</span>
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

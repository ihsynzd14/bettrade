'use client'

const ITEMS = [
  'GENIUS SPORTS LIVE DATA',
  'BETFAIR EXCHANGE',
  '< 250MS LATENCY',
  'FULLY AUTOMATED',
  'IN-PLAY EXECUTION',
  'REAL-TIME SIGNALS',
  'ZERO MANUAL INPUT',
  'BETFAIR STREAM API',
]

export default function Marquee() {
  const doubled = [...ITEMS, ...ITEMS]

  return (
    <div className="border-y border-zinc-800 bg-zinc-900/60 overflow-hidden py-3">
      <div
        className="flex whitespace-nowrap"
        style={{ animation: 'marquee 30s linear infinite' }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-6 mx-6">
            <span className="font-mono text-xs tracking-[0.15em] text-zinc-500">{item}</span>
            <span className="text-sky-500/40">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}

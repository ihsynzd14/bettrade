import type { ScalpySummary } from '@/types/scalpy'

interface Props {
  summary: ScalpySummary
}

interface Stat {
  label: string
  value: string
  valueClass?: string
  hero?: boolean
}

export function ScalpySummaryBar({ summary }: Props) {
  const pnlColor = summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const todayColor = summary.todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'

  const stats: Stat[] = [
    { label: 'Total Bets', value: String(summary.total) },
    {
      label: 'Win Rate',
      value: summary.winRate !== null ? `${summary.winRate}%` : '—',
    },
    {
      label: 'Total P&L',
      value: summary.totalPnl !== undefined
        ? `${summary.totalPnl >= 0 ? '+' : ''}£${summary.totalPnl.toFixed(2)}`
        : '—',
      valueClass: pnlColor,
      hero: true,
    },
    {
      label: "Today's P&L",
      value: summary.todayPnl !== undefined
        ? `${summary.todayPnl >= 0 ? '+' : ''}£${summary.todayPnl.toFixed(2)}`
        : '—',
      valueClass: todayColor,
    },
  ]

  // One instrument band, hairline-divided cells (the homepage stats-band anatomy) —
  // not a stack of identical cards. Cell borders per index: 2x2 on mobile, 1x4 from sm.
  const cellBorders = [
    'border-b sm:border-b-0 border-r',
    'border-b sm:border-b-0 sm:border-r',
    'border-r',
    '',
  ]

  return (
    <div className="sc-card sc-rise overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {stats.map(({ label, value, valueClass, hero }, i) => (
          <div
            key={label}
            className={`flex flex-col gap-1.5 px-4 py-4 sm:py-5 border-[var(--sc-hairline)] ${cellBorders[i]} ${hero ? (summary.totalPnl >= 0 ? 'sc-strip-pos' : 'sc-strip-neg') : ''}`}
          >
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.15em]">{label}</div>
            <div
              className={hero
                ? `text-3xl sm:text-4xl sc-money leading-none ${valueClass}`
                : `text-xl sm:text-2xl sc-money ${valueClass ?? 'text-zinc-100'}`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

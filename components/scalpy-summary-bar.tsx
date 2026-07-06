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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, valueClass, hero }, i) => (
        <div
          key={label}
          className={`sc-card sc-rise sc-lift px-4 py-3.5 space-y-1.5 ${hero ? 'sc-card-hero' : ''} ${hero ? (summary.totalPnl >= 0 ? 'sc-strip-pos' : 'sc-strip-neg') : ''}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.14em]">{label}</div>
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
  )
}

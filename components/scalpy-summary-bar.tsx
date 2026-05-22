import type { ScalpySummary } from '@/types/scalpy'

interface Props {
  summary: ScalpySummary
}

export function ScalpySummaryBar({ summary }: Props) {
  const pnlColor = summary.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const todayColor = summary.todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
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
        },
        {
          label: "Today's P&L",
          value: summary.todayPnl !== undefined
            ? `${summary.todayPnl >= 0 ? '+' : ''}£${summary.todayPnl.toFixed(2)}`
            : '—',
          valueClass: todayColor,
        },
      ].map(({ label, value, valueClass }) => (
        <div
          key={label}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-1"
        >
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">{label}</div>
          <div className={`text-xl font-mono font-bold ${valueClass ?? 'text-white'}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}

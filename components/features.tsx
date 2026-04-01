interface Feature {
  title: string
  description: string
  icon: string
  large?: boolean
}

const FEATURES: Feature[] = [
  {
    title: 'Real-Time Data Ingestion',
    description:
      'Genius Sports match events stream via Ably with under 250ms end-to-end latency. Every goal, card, and substitution triggers immediate signal evaluation.',
    icon: '⚡',
    large: true,
  },
  {
    title: 'Automated Execution',
    description:
      'Betfair Exchange REST and Stream APIs handle order placement, cancellation, and update — no manual input at any stage.',
    icon: '🤖',
    large: true,
  },
  {
    title: 'Smart Order Management',
    description: 'Lay/Back logic with in-play position tracking and automatic order sizing.',
    icon: '📊',
  },
  {
    title: 'Risk Controls',
    description: 'Per-match exposure limits, daily loss caps, and auto-pause on drawdown thresholds.',
    icon: '🛡',
  },
  {
    title: 'Performance Analytics',
    description: 'Full P&L tracking, win rate, edge analysis, and historical trade replay.',
    icon: '📈',
  },
  {
    title: 'Audit Trail',
    description: 'Every order logged with timestamp, reasoning, market state, and outcome.',
    icon: '🗂',
  },
]

export default function Features() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400 mb-3">
            Capabilities
          </p>
          <h2 className="font-sans font-bold text-4xl tracking-tight text-zinc-50">
            Everything the edge needs.
          </h2>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={[
                'group rounded-xl border border-zinc-800 bg-zinc-900 p-6',
                'hover:border-sky-500/40 hover:bg-sky-500/5 transition-all duration-300',
                feature.large ? 'lg:col-span-2' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="text-2xl mb-4">{feature.icon}</div>
              <h3 className="font-sans font-semibold text-base text-zinc-50 mb-2">
                {feature.title}
              </h3>
              <p className="font-sans text-sm text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

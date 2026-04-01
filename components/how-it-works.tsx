interface Step {
  number: number
  title: string
  description: string
  detail: string
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Ingest',
    description: 'Genius Sports data arrives',
    detail:
      'Live match events — goals, cards, substitutions, possession changes — stream via Ably WebSocket. Each event is parsed and normalised in under 250ms from the moment it occurs on the pitch.',
  },
  {
    number: 2,
    title: 'Analyze',
    description: 'Signal logic evaluates state',
    detail:
      'The signal engine evaluates the current match state against pre-configured strategy rules: live odds movement, expected-goals model output, in-play momentum, and value threshold conditions.',
  },
  {
    number: 3,
    title: 'Decide',
    description: 'Strategy generates order params',
    detail:
      'When a signal fires, the strategy engine calculates order parameters: market ID, selection, price, stake size, and expiry. Position limits and daily caps are checked before the order is approved.',
  },
  {
    number: 4,
    title: 'Execute',
    description: 'Betfair API places the order',
    detail:
      'The approved order is submitted to the Betfair Exchange REST API. Confirmation, matched amount, and average matched price are immediately logged. The Stream API monitors the live order status.',
  },
  {
    number: 5,
    title: 'Monitor',
    description: 'Positions tracked continuously',
    detail:
      'Open positions are watched for exit conditions: target price hit, match state change, or stop-loss trigger. Automated hedging or cash-out requests are submitted as required.',
  },
]

export default function HowItWorks() {
  return (
    <section className="py-24 px-6 border-t border-zinc-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400 mb-3">
            Process
          </p>
          <h2 className="font-sans font-bold text-4xl tracking-tight text-zinc-50">
            From data to execution in milliseconds.
          </h2>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-800 hidden md:block" />

          <div className="space-y-0">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="relative flex gap-8 md:gap-12 pb-12 last:pb-0"
              >
                {/* Step circle */}
                <div className="relative z-10 shrink-0 w-10 h-10 rounded-full border border-sky-500/60 bg-zinc-950 flex items-center justify-center">
                  <span className="font-mono text-xs font-bold text-sky-400">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 grid md:grid-cols-2 gap-4 pt-1.5 pb-4 border-b border-zinc-800/60 last:border-0">
                  <div>
                    <h3 className="font-sans font-semibold text-xl text-zinc-50 mb-1">
                      {step.title}
                    </h3>
                    <p className="font-mono text-xs text-zinc-500 uppercase tracking-wide">
                      {step.description}
                    </p>
                  </div>
                  <p className="font-sans text-sm text-zinc-400 leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

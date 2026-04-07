import ExecutionPanel from './execution-panel'

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center bg-grid overflow-hidden">
      {/* Radial glow behind right panel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/4 w-[600px] h-[600px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-6 w-full py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left: text */}
        <div className="space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
            Automated Betfair Trading
          </p>

          <h1 className="font-sans font-bold text-5xl lg:text-6xl leading-[1.1] tracking-tight text-zinc-50">
            Trade the Market.<br />
            <span className="text-sky-400">Beat the Speed.</span>
          </h1>

          <p className="font-sans text-lg text-zinc-400 leading-relaxed max-w-xl">
            Bettrade connects Genius Sports real-time match intelligence directly to the Betfair Exchange
            — analyzing signals, sizing positions, and executing orders in under 250 milliseconds.
            No dashboards. No delays. Just automated edge.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="/fixtures"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-sky-500 hover:bg-sky-400 text-white font-medium text-sm transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              View Live Fixtures
            </a>
            <button className="px-6 py-2.5 rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-50 font-medium text-sm transition-colors cursor-pointer">
              View Docs
            </button>
          </div>
        </div>

        {/* Right: execution panel */}
        <div>
          <ExecutionPanel />
        </div>
      </div>
    </section>
  )
}

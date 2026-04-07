export default function Cta() {
  return (
    <footer>
      {/* CTA block */}
      <section className="py-24 px-6 border-t-2 border-sky-500/20 bg-zinc-950">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
            Live Data
          </p>
          <h2 className="font-sans font-bold text-4xl lg:text-5xl tracking-tight text-zinc-50">
            See the markets in real time.
          </h2>
          <p className="font-sans text-lg text-zinc-400">
            Genius Sports fixtures matched with Betfair Exchange odds &mdash; updated
            every 60 seconds with live back/lay prices and volume.
          </p>
          <a
            href="/fixtures"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-md bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            View Live Fixtures
          </a>
        </div>
      </section>

      {/* Footer bar */}
      <div className="border-t border-zinc-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-zinc-600">
          <span>&copy; 2026 Bettrade</span>
          <span>Automated Betfair Exchange trading</span>
        </div>
      </div>
    </footer>
  )
}

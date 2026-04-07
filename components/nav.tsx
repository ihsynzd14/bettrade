import ThemeToggle from './theme-toggle'

export default function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 backdrop-blur-md bg-zinc-950/80">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="font-sans font-semibold text-lg tracking-tight text-zinc-50">
          Bettrade
        </a>

        <div className="flex items-center gap-3">
          <a
            href="/fixtures"
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 hover:border-sky-400/50 hover:text-sky-300 transition-all"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>
            Live Fixtures
          </a>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import ThemeToggle from './theme-toggle'

export default function Nav() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 backdrop-blur-md bg-zinc-950/70 shadow-[inset_0_-1px_0_var(--sc-hairline)]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-sans font-semibold text-lg tracking-tight text-zinc-50">
          <span className="h-4 w-1 rounded-full" style={{ background: 'var(--sc-accent)' }} />Bettrade
        </a>

        <div className="flex items-center gap-3">
          <a
            href="/scalpy"
            data-active={pathname === '/scalpy'}
            className="sc-navlink text-sm font-mono px-3 py-1.5 transition-colors text-zinc-400 hover:text-zinc-100 data-[active=true]:text-zinc-50"
          >
            Scalpy
          </a>

          <a
            href="/results"
            data-active={pathname === '/results'}
            className="sc-navlink text-sm font-mono px-3 py-1.5 transition-colors text-zinc-400 hover:text-zinc-100 data-[active=true]:text-zinc-50"
          >
            Results
          </a>

          <a
            href="/admin"
            data-active={pathname === '/admin'}
            className="sc-navlink text-sm font-mono px-3 py-1.5 transition-colors text-zinc-500 hover:text-rose-400 data-[active=true]:text-zinc-50"
          >
            Admin
          </a>

          <a
            href="/live-fixtures"
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md bg-[var(--sc-accent-soft)] border border-sky-500/30 text-sky-400 hover:border-sky-400/50 hover:text-sky-300 transition-colors"
          >
            <span className="sc-live-dot text-sky-400" />
            Live Fixtures
          </a>

          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

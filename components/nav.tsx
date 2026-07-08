'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import ThemeToggle from './theme-toggle'

interface NavLink {
  href: string
  label: string
  index: string
  danger?: boolean
}

const LINKS: NavLink[] = [
  { href: '/scalpy', label: 'Scalpy', index: '01' },
  { href: '/results', label: 'Results', index: '02' },
  { href: '/admin', label: 'Admin', index: '03', danger: true },
]

export default function Nav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setIsOpen(false), [pathname])

  return (
    // Floating glass island: detached from the viewport edge (8px + 44px stays under the
    // pages' pt-14 offset — no page layout changes). The outer strip is pointer-transparent.
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-2">
      <nav
        className={`sc-navrail pointer-events-auto relative mx-auto flex h-11 max-w-5xl items-center justify-between gap-2 rounded-2xl border border-[var(--sc-hairline)] pl-3.5 pr-1.5 backdrop-blur-xl sm:gap-3 ${
          isScrolled ? 'bg-zinc-950/85 shadow-[var(--sc-shadow-lift)]' : 'bg-zinc-950/60'
        }`}
      >
        {/* Brand — framed instrument tick + mono suffix */}
        <a href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-[5px] border border-[var(--sc-hairline)] bg-[var(--sc-elev-2)]">
            <span className="sc-nav-motion h-2.5 w-[3px] rounded-full bg-[var(--sc-accent)] group-hover:scale-y-125" />
          </span>
          <span className="font-sans text-[15px] font-semibold tracking-tight text-zinc-50">
            Bettrade
          </span>
          <span aria-hidden="true" className="hidden h-3 w-px bg-[var(--sc-hairline)] lg:block" />
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500 lg:block">
            Terminal
          </span>
        </a>

        {/* Desktop links — segmented pills, active = accent-soft + accent index */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ href, label, index, danger }) => {
            const active = pathname === href
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  active
                    ? 'bg-[var(--sc-accent-soft)] text-zinc-50'
                    : danger
                      ? 'text-zinc-500 hover:text-rose-400'
                      : 'text-zinc-400 hover:bg-zinc-500/10 hover:text-zinc-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`text-[9px] transition-colors ${active ? 'text-[var(--sc-accent)]' : 'text-zinc-600 group-hover:text-zinc-500'}`}
                >
                  {index}
                </span>
                {label}
              </a>
            )
          })}
        </div>

        {/* Status cluster — signal chip, divider, theme toggle, burger */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href="/live-fixtures"
            aria-current={pathname === '/live-fixtures' ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-lg border bg-[var(--sc-accent-soft)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:border-sky-400/50 hover:text-sky-300 ${
              pathname === '/live-fixtures' ? 'border-sky-400/60 text-sky-300' : 'border-sky-500/30 text-sky-400'
            }`}
          >
            <span className="sc-live-dot text-sky-400" />
            <span className="hidden sm:inline">Live Fixtures</span>
            <span className="sm:hidden">Live</span>
          </a>

          <span aria-hidden="true" className="hidden h-5 w-px bg-[var(--sc-hairline)] md:block" />

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle menu"
            className="flex h-8 w-8 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-lg border border-[var(--sc-hairline)] text-zinc-400 transition-colors hover:bg-zinc-500/10 hover:text-zinc-100 md:hidden"
          >
            <span className={`sc-nav-motion block h-px w-4 bg-current ${isOpen ? 'translate-y-[3px] rotate-45' : ''}`} />
            <span className={`sc-nav-motion block h-px w-4 bg-current ${isOpen ? '-translate-y-[3px] -rotate-45' : ''}`} />
          </button>
        </div>

        {/* Mobile panel — its own glass island below the bar; popover fade+drop (always
            mounted, inert when closed so it's out of the tab order and hit-testing) */}
        <div
          id="mobile-nav"
          inert={!isOpen}
          className={`sc-navpop absolute inset-x-0 top-full mt-2 origin-top rounded-2xl border border-[var(--sc-hairline)] bg-zinc-950/90 backdrop-blur-xl shadow-[var(--sc-shadow-lift)] md:hidden ${
            isOpen ? 'opacity-100 translate-y-0 scale-100' : 'pointer-events-none opacity-0 -translate-y-1.5 scale-[0.98]'
          }`}
        >
          <nav className="flex flex-col gap-1 p-1.5">
            {LINKS.map(({ href, label, index, danger }) => {
              const active = pathname === href
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 font-mono text-xs uppercase tracking-[0.2em] transition-colors ${
                    active
                      ? 'bg-[var(--sc-accent-soft)] text-zinc-50 [box-shadow:inset_2px_0_0_var(--sc-accent)]'
                      : danger
                        ? 'text-zinc-500 hover:text-rose-400'
                        : 'text-zinc-400 hover:bg-zinc-500/10 hover:text-zinc-100'
                  }`}
                >
                  <span aria-hidden="true" className="text-[9px] text-zinc-600">
                    {index}
                  </span>
                  {label}
                </a>
              )
            })}
          </nav>
        </div>
      </nav>
    </header>
  )
}

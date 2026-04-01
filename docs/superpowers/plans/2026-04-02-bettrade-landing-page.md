# Bettrade Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js 15 landing page for the Bettrade automated trading bot product, styled in black/zinc + electric blue with Space Grotesk font, featuring a live execution panel, bento features grid, pipeline steps, stats bar, and CTA footer.

**Architecture:** Single-page Next.js 15 App Router project with no backend. Each visual section is a dedicated server component file. Client-only interactivity (animations, live panel scroll) lives in isolated `"use client"` components to keep the server component tree clean.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion, `next/font` (Space Grotesk + JetBrains Mono)

---

## File Map

| File | Responsibility |
|------|----------------|
| `package.json` | Project deps — Next.js 15, Framer Motion, TypeScript |
| `next.config.ts` | Next.js config — port 4000 via `npm run dev` script |
| `tailwind.config.ts` | Tailwind v4 config — custom color tokens, font families |
| `app/globals.css` | Base styles, CSS variables, grid overlay texture |
| `app/layout.tsx` | Root layout — font loading, metadata, html/body |
| `app/page.tsx` | Page assembly — imports all section components |
| `components/nav.tsx` | Fixed top nav — wordmark + CTA button (server) |
| `components/hero.tsx` | Hero section shell — 2-col grid (server) |
| `components/execution-panel.tsx` | Live execution monitor card — animated scroll log (`"use client"`) |
| `components/marquee.tsx` | Scrolling ticker strip (`"use client"`) |
| `components/features.tsx` | Bento grid — 6 feature cards (server) |
| `components/how-it-works.tsx` | Pipeline steps — sticky left, scrolling right (server) |
| `components/stats.tsx` | Full-width stats bar (server) |
| `components/cta.tsx` | CTA section + footer (server) |

---

## Task 1: Scaffold the Next.js 15 Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialise the project**

Run from the `bettrade/` directory:
```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias --turbopack
```
Answer prompts:
- Would you like to use ESLint? → Yes
- Would you like to customize the import alias? → No

- [ ] **Step 2: Install additional dependencies**

```bash
npm install framer-motion
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```
Expected: Server starts on port 3000, no errors in terminal.

- [ ] **Step 4: Update `next.config.ts` to expose port config cleanly**

Replace the generated `next.config.ts` with:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

Update `package.json` scripts so `dev` runs on port 4000:
```json
"scripts": {
  "dev": "next dev --turbopack -p 4000",
  "build": "next build",
  "start": "next start -p 4000",
  "lint": "next lint"
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js 15 project for bettrade landing page"
```

---

## Task 2: Tailwind Config + Global Styles

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Update `tailwind.config.ts` with custom tokens**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#0ea5e9',
          dim: '#0369a1',
          glow: 'rgba(14,165,233,0.15)',
        },
      },
      fontFamily: {
        sans: ['var(--font-space-grotesk)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'fade-in': 'fadeIn 0.6s ease forwards',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Replace `app/globals.css` with base styles**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #09090b;
  --surface: #18181b;
  --border: #27272a;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--bg);
  color: #fafafa;
  -webkit-font-smoothing: antialiased;
}

/* Subtle grid overlay — used on hero */
.bg-grid {
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: configure tailwind tokens and global styles"
```

---

## Task 3: Root Layout + Font Setup

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `app/layout.tsx` with font setup and metadata**

```tsx
import type { Metadata } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bettrade — Automated Betfair Trading',
  description:
    'Real-time Genius Sports data connected directly to the Betfair Exchange. Automated signal analysis and order execution in under 250ms.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-zinc-950 text-zinc-50">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify dev server renders with correct fonts**

Run `npm run dev`, open `http://localhost:4000`. Page should load with Space Grotesk applied (visible in DevTools → Elements → Computed styles → font-family).

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: set up root layout with Space Grotesk and JetBrains Mono fonts"
```

---

## Task 4: Navigation Component

**Files:**
- Create: `components/nav.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/nav.tsx`**

```tsx
export default function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 backdrop-blur-md bg-zinc-950/80">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="font-sans font-semibold text-lg tracking-tight text-zinc-50">
          Bettrade
        </span>
        <button className="px-4 py-1.5 text-sm font-medium rounded-md bg-sky-500 hover:bg-sky-400 text-white transition-colors">
          Request Access
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update `app/page.tsx` to render Nav**

```tsx
import Nav from '@/components/nav'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-14">
        {/* sections go here */}
      </main>
    </>
  )
}
```

- [ ] **Step 3: Check in browser**

Open `http://localhost:4000`. Should see a fixed dark nav bar with "Bettrade" on left and "Request Access" button on right.

- [ ] **Step 4: Commit**

```bash
git add components/nav.tsx app/page.tsx
git commit -m "feat: add fixed navigation bar"
```

---

## Task 5: Execution Panel Component (Client)

**Files:**
- Create: `components/execution-panel.tsx`

This is a `"use client"` component. It auto-scrolls through fake trade log entries to simulate a live execution feed.

- [ ] **Step 1: Create `components/execution-panel.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface LogEntry {
  id: number
  time: string
  status: 'PLACED' | 'MATCHED' | 'PENDING' | 'SETTLED'
  match: string
  side: 'Back' | 'Lay'
  odds: string
  stake: string
}

const LOG_ENTRIES: LogEntry[] = [
  { id: 1,  time: '14:32:07', status: 'MATCHED',  match: 'Man City vs Chelsea',    side: 'Back', odds: '1.85', stake: '£50'  },
  { id: 2,  time: '14:32:11', status: 'PLACED',   match: 'Arsenal vs Liverpool',   side: 'Lay',  odds: '2.10', stake: '£30'  },
  { id: 3,  time: '14:32:19', status: 'SETTLED',  match: 'Real Madrid vs Barca',   side: 'Back', odds: '1.62', stake: '£100' },
  { id: 4,  time: '14:32:24', status: 'MATCHED',  match: 'PSG vs Bayern',          side: 'Back', odds: '2.40', stake: '£40'  },
  { id: 5,  time: '14:32:31', status: 'PENDING',  match: 'Juventus vs Inter',      side: 'Lay',  odds: '1.95', stake: '£60'  },
  { id: 6,  time: '14:32:38', status: 'PLACED',   match: 'Dortmund vs Leipzig',    side: 'Back', odds: '1.75', stake: '£80'  },
  { id: 7,  time: '14:32:45', status: 'MATCHED',  match: 'Atletico vs Sevilla',    side: 'Lay',  odds: '3.20', stake: '£25'  },
  { id: 8,  time: '14:32:52', status: 'SETTLED',  match: 'Porto vs Benfica',       side: 'Back', odds: '2.05', stake: '£45'  },
]

const STATUS_STYLES: Record<LogEntry['status'], string> = {
  PLACED:  'text-sky-400',
  MATCHED: 'text-emerald-400',
  PENDING: 'text-zinc-400',
  SETTLED: 'text-zinc-500',
}

export default function ExecutionPanel() {
  const [visible, setVisible] = useState<LogEntry[]>(LOG_ENTRIES.slice(0, 4))
  const [index, setIndex] = useState(4)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      const next = LOG_ENTRIES[index % LOG_ENTRIES.length]
      setVisible(prev => [...prev.slice(-6), { ...next, id: Date.now() }])
      setIndex(i => i + 1)
    }, 1800)
    return () => clearInterval(interval)
  }, [index])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visible])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
          Live Execution Monitor
        </span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-xs text-emerald-400">LIVE</span>
        </span>
      </div>

      {/* Log */}
      <div ref={scrollRef} className="h-48 overflow-y-auto px-4 py-2 space-y-1.5 scrollbar-none">
        {visible.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2 text-xs font-mono animate-fade-in">
            <span className="text-zinc-600 shrink-0 w-16">{entry.time}</span>
            <span className={`shrink-0 w-16 font-semibold ${STATUS_STYLES[entry.status]}`}>
              {entry.status}
            </span>
            <span className="text-zinc-300 truncate flex-1">{entry.match}</span>
            <span className="text-zinc-500 shrink-0">{entry.side}</span>
            <span className="text-sky-400 shrink-0 w-10 text-right">{entry.odds}</span>
            <span className="text-zinc-300 shrink-0 w-10 text-right">{entry.stake}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-t border-zinc-800">
        {[
          { label: 'Trades Today', value: '142' },
          { label: 'Win Rate',     value: '68%' },
          { label: 'Avg Latency',  value: '218ms' },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center py-3 border-r border-zinc-800 last:border-r-0">
            <span className="font-sans font-semibold text-sm text-zinc-50">{stat.value}</span>
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/execution-panel.tsx
git commit -m "feat: add live execution panel with animated trade log"
```

---

## Task 6: Hero Section

**Files:**
- Create: `components/hero.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/hero.tsx`**

```tsx
import ExecutionPanel from './execution-panel'

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center bg-grid overflow-hidden">
      {/* Radial glow behind right panel */}
      <div
        aria-hidden
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
            <button className="px-6 py-2.5 rounded-md bg-sky-500 hover:bg-sky-400 text-white font-medium text-sm transition-colors">
              Request Access
            </button>
            <button className="px-6 py-2.5 rounded-md border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-50 font-medium text-sm transition-colors">
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
```

- [ ] **Step 2: Add `Hero` to `app/page.tsx`**

```tsx
import Nav from '@/components/nav'
import Hero from '@/components/hero'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-14">
        <Hero />
      </main>
    </>
  )
}
```

- [ ] **Step 3: Check in browser**

Open `http://localhost:4000`. Should see:
- Left side: eyebrow label in sky blue, large headline with "Beat the Speed." in sky blue, subtext, two buttons
- Right side: dark card with "LIVE EXECUTION MONITOR", scrolling trade log entries, three stats at bottom
- Subtle grid texture in background
- Blue radial glow behind the panel

- [ ] **Step 4: Commit**

```bash
git add components/hero.tsx app/page.tsx
git commit -m "feat: add hero section with execution panel"
```

---

## Task 7: Marquee Ticker

**Files:**
- Create: `components/marquee.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/marquee.tsx`**

```tsx
'use client'

const ITEMS = [
  'GENIUS SPORTS LIVE DATA',
  'BETFAIR EXCHANGE',
  '< 250MS LATENCY',
  'FULLY AUTOMATED',
  'IN-PLAY EXECUTION',
  'REAL-TIME SIGNALS',
  'ZERO MANUAL INPUT',
  'BETFAIR STREAM API',
]

export default function Marquee() {
  const doubled = [...ITEMS, ...ITEMS]

  return (
    <div className="border-y border-zinc-800 bg-zinc-900/60 overflow-hidden py-3">
      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-6 mx-6">
            <span className="font-mono text-xs tracking-[0.15em] text-zinc-500">{item}</span>
            <span className="text-sky-500/40">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `Marquee` to `app/page.tsx` after `Hero`**

```tsx
import Nav from '@/components/nav'
import Hero from '@/components/hero'
import Marquee from '@/components/marquee'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-14">
        <Hero />
        <Marquee />
      </main>
    </>
  )
}
```

- [ ] **Step 3: Check in browser**

Should see a dark strip below the hero with continuously scrolling uppercase text items separated by diamond glyphs.

- [ ] **Step 4: Commit**

```bash
git add components/marquee.tsx app/page.tsx
git commit -m "feat: add scrolling marquee ticker below hero"
```

---

## Task 8: Features Bento Grid

**Files:**
- Create: `components/features.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/features.tsx`**

```tsx
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
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400 mb-3">Capabilities</p>
          <h2 className="font-sans font-bold text-4xl tracking-tight text-zinc-50">
            Everything the edge needs.
          </h2>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={[
                'group rounded-xl border border-zinc-800 bg-zinc-900 p-6',
                'hover:border-sky-500/40 hover:bg-sky-500/5 transition-all duration-300',
                feature.large ? 'lg:col-span-2' : '',
              ].join(' ')}
            >
              <div className="text-2xl mb-4">{feature.icon}</div>
              <h3 className="font-sans font-semibold text-base text-zinc-50 mb-2">{feature.title}</h3>
              <p className="font-sans text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add `Features` to `app/page.tsx`**

```tsx
import Nav from '@/components/nav'
import Hero from '@/components/hero'
import Marquee from '@/components/marquee'
import Features from '@/components/features'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-14">
        <Hero />
        <Marquee />
        <Features />
      </main>
    </>
  )
}
```

- [ ] **Step 3: Check in browser**

Should see a 4-column bento grid. First two cards span 2 columns each (on large screens). All cards have hover state that adds a faint sky blue border glow.

- [ ] **Step 4: Commit**

```bash
git add components/features.tsx app/page.tsx
git commit -m "feat: add features bento grid section"
```

---

## Task 9: How It Works Pipeline

**Files:**
- Create: `components/how-it-works.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/how-it-works.tsx`**

```tsx
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
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400 mb-3">Process</p>
          <h2 className="font-sans font-bold text-4xl tracking-tight text-zinc-50">
            From data to execution in milliseconds.
          </h2>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-800 hidden md:block" />

          <div className="space-y-0">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative flex gap-8 md:gap-12 pb-12 last:pb-0">
                {/* Step circle */}
                <div className="relative z-10 shrink-0 w-10 h-10 rounded-full border border-sky-500/60 bg-zinc-950 flex items-center justify-center">
                  <span className="font-mono text-xs font-bold text-sky-400">{step.number}</span>
                </div>

                {/* Content */}
                <div className="flex-1 grid md:grid-cols-2 gap-4 pt-1.5 pb-4 border-b border-zinc-800/60 last:border-0">
                  <div>
                    <h3 className="font-sans font-semibold text-xl text-zinc-50 mb-1">{step.title}</h3>
                    <p className="font-mono text-xs text-zinc-500 uppercase tracking-wide">{step.description}</p>
                  </div>
                  <p className="font-sans text-sm text-zinc-400 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add `HowItWorks` to `app/page.tsx`**

```tsx
import Nav from '@/components/nav'
import Hero from '@/components/hero'
import Marquee from '@/components/marquee'
import Features from '@/components/features'
import HowItWorks from '@/components/how-it-works'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-14">
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
      </main>
    </>
  )
}
```

- [ ] **Step 3: Check in browser**

Should see 5 numbered steps, each with a sky-blue circle on the left, vertical dashed connector line between them, and a two-column layout (title left, detail right).

- [ ] **Step 4: Commit**

```bash
git add components/how-it-works.tsx app/page.tsx
git commit -m "feat: add pipeline how-it-works section"
```

---

## Task 10: Stats Bar

**Files:**
- Create: `components/stats.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/stats.tsx`**

```tsx
const STATS = [
  { value: '< 250ms', label: 'Data Latency' },
  { value: '5,000',   label: 'API Tx / Hour' },
  { value: '100%',    label: 'Automated' },
  { value: '24 / 7',  label: 'Always On' },
]

export default function Stats() {
  return (
    <section className="border-y border-zinc-800 bg-zinc-900/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center py-12 border-r border-zinc-800 last:border-r-0 [&:nth-child(2)]:border-r-0 lg:[&:nth-child(2)]:border-r"
            >
              <span className="font-sans font-bold text-4xl lg:text-5xl text-zinc-50 tracking-tight">
                {stat.value}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-500 mt-2">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add `Stats` to `app/page.tsx`**

```tsx
import Nav from '@/components/nav'
import Hero from '@/components/hero'
import Marquee from '@/components/marquee'
import Features from '@/components/features'
import HowItWorks from '@/components/how-it-works'
import Stats from '@/components/stats'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-14">
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
        <Stats />
      </main>
    </>
  )
}
```

- [ ] **Step 3: Check in browser**

Should see a 4-column strip with large bold numbers and monospace labels beneath each.

- [ ] **Step 4: Commit**

```bash
git add components/stats.tsx app/page.tsx
git commit -m "feat: add stats bar section"
```

---

## Task 11: CTA + Footer

**Files:**
- Create: `components/cta.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/cta.tsx`**

```tsx
export default function Cta() {
  return (
    <footer>
      {/* CTA block */}
      <section className="py-24 px-6 border-t-2 border-sky-500/20 bg-zinc-950">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">Early Access</p>
          <h2 className="font-sans font-bold text-4xl lg:text-5xl tracking-tight text-zinc-50">
            Built for serious traders.
          </h2>
          <p className="font-sans text-lg text-zinc-400">
            Bettrade is currently in private preview. If you&apos;re interested in early access, get in touch.
          </p>
          <button className="px-8 py-3 rounded-md bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition-colors">
            Request Access
          </button>
        </div>
      </section>

      {/* Footer bar */}
      <div className="border-t border-zinc-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-zinc-600">
          <span>© 2026 Bettrade</span>
          <span>Private preview — not for public distribution</span>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Add `Cta` to `app/page.tsx`**

```tsx
import Nav from '@/components/nav'
import Hero from '@/components/hero'
import Marquee from '@/components/marquee'
import Features from '@/components/features'
import HowItWorks from '@/components/how-it-works'
import Stats from '@/components/stats'
import Cta from '@/components/cta'

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-14">
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
        <Stats />
        <Cta />
      </main>
    </>
  )
}
```

- [ ] **Step 3: Check complete page in browser**

Scroll through the full page top-to-bottom:
1. Fixed nav visible at top
2. Hero with headline + execution panel
3. Scrolling marquee strip
4. Features bento grid
5. How It Works pipeline steps
6. Stats bar (4 numbers)
7. CTA section with "Built for serious traders."
8. Footer with copyright + disclaimer

- [ ] **Step 4: Commit**

```bash
git add components/cta.tsx app/page.tsx
git commit -m "feat: add CTA and footer section — landing page complete"
```

---

## Task 12: Polish + Responsiveness Check

**Files:**
- Modify: `app/globals.css` (minor tweaks if needed)
- Modify: any component as needed

- [ ] **Step 1: Check mobile layout (375px)**

In browser DevTools, set viewport to 375px wide. Verify:
- Nav: wordmark + button visible, no overflow
- Hero: single column, execution panel stacks below text
- Features: 2 columns on mobile (1 col on very small)
- How It Works: single column, connector line hidden
- Stats: 2×2 grid
- CTA: centered, no overflow

Fix any issues found.

- [ ] **Step 2: Check that marquee animation is smooth**

Marquee should loop seamlessly. If there's a visible jump, verify `ITEMS` array is doubled and animation duration is `30s linear infinite`.

- [ ] **Step 3: Check execution panel scroll behaviour**

Watch the panel for ~10 seconds. New entries should appear at the bottom, old entries scroll up, panel never grows beyond its fixed height.

- [ ] **Step 4: Add `scrollbar-none` utility to globals if missing**

If the execution panel scroll bar is visible, add to `app/globals.css`:
```css
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "polish: responsive fixes and scrollbar cleanup"
```

---

## Self-Review Against Spec

| Spec requirement | Task |
|---|---|
| Nav: fixed, wordmark left, CTA right | Task 4 |
| Hero: eyebrow label, H1, subtext, 2 CTAs | Task 6 |
| Hero: 2-col grid on large screens | Task 6 |
| Live execution panel: scrolling log, stats row, green dot | Task 5 |
| Marquee ticker below hero | Task 7 |
| Features: 6 cards, bento grid, hover blue border | Task 8 |
| How It Works: 5 steps, numbered circles, connector line | Task 9 |
| Stats: 4 stats, full-width, dividers | Task 10 |
| CTA: headline, subtext, button, footer disclaimer | Task 11 |
| Space Grotesk + JetBrains Mono fonts | Task 3 |
| Zinc + electric blue `#0ea5e9` palette | Task 2 |
| Grid overlay texture on hero | Task 2, 6 |
| Port 4000 | Task 1 |
| No backend, no auth | All tasks — confirmed by absence |

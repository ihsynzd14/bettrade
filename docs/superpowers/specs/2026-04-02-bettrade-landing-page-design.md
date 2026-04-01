# Bettrade Landing Page — Design Spec

**Date:** 2026-04-02  
**Status:** Approved  
**Product:** Bettrade — Automated Betfair Exchange trading bot  
**Audience:** Private client preview (Ersen)  

---

## 1. Project Overview

A standalone Next.js (latest) landing page for the Bettrade product. This is a private pitch/preview page — not publicly launched yet. The goal is to present the product vision: an automated trading bot that ingests Genius Sports real-time match data and executes trades on the Betfair Exchange.

This is a **new, separate Next.js project** inside `bettrade/` — it does not touch the existing `psychobet/` app.

---

## 2. Design Language

### Color Palette
| Token          | Value       | Usage                                 |
|----------------|-------------|---------------------------------------|
| Background     | `#09090b`   | Page background (zinc-950)            |
| Surface        | `#18181b`   | Cards, panels (zinc-900)              |
| Border         | `#27272a`   | Card borders, dividers (zinc-800)     |
| Text primary   | `#fafafa`   | Headings, key labels                  |
| Text secondary | `#a1a1aa`   | Body copy, descriptions (zinc-400)    |
| Text muted     | `#52525b`   | Timestamps, dim data (zinc-600)       |
| Accent         | `#0ea5e9`   | CTAs, highlights, live indicators     |
| Accent dim     | `#0369a1`   | Hover states, borders on focus        |
| Accent glow    | `rgba(14,165,233,0.15)` | Glow effects, card hover bg |

### Typography
- **Primary font:** Space Grotesk — headings, navigation, labels, UI text
- **Mono font:** JetBrains Mono or `font-mono` — live data numbers, code snippets, execution logs
- Type scale: tight tracking on headings (`tracking-tight`), slightly loose on labels (`tracking-wide uppercase text-xs`)

### Visual Language
- Predominantly **dark mode only** — no light mode variant
- Borders over shadows — use `border border-zinc-800` rather than drop shadows
- Subtle blue glow on interactive/highlighted elements
- Grid overlay texture on hero background (very subtle — 1px lines at low opacity)
- Marquee ticker (scrolling) for live feel

---

## 3. Page Structure & Sections

### 3.1 Navigation
- Fixed top bar, transparent with `backdrop-blur`
- Left: `Bettrade` wordmark (Space Grotesk, white)
- Right: one CTA button — "Request Access" (blue, small)
- Minimal — no nav links (single-page product pitch)

### 3.2 Hero Section (2-column layout from C + scrolling marquee from B)
**Left column (text):**
- Eyebrow label: `AUTOMATED BETFAIR TRADING` (uppercase, accent blue, small mono)
- H1: Large headline — "Trade Smarter. Execute Faster." or similar
- Subheadline: 2–3 lines describing the product (Genius Sports data → automated execution on Betfair Exchange)
- Two CTAs: Primary "Request Access" (blue filled) + Secondary "View Docs" (ghost/border)

**Right column (live execution panel from C):**
- Dark card with `bg-zinc-900 border border-zinc-800`
- Header bar: "LIVE EXECUTION MONITOR" label + green pulsing dot
- Scrolling log of fake live trade events (e.g., "BET PLACED — Man City vs Chelsea — Back 1.85 — £50")
- A mini stats row: Trades Today / Win Rate / Avg Latency
- Accent blue highlights on matched/executed entries

**Below hero:**
- Scrolling marquee ticker (from B) — "GENIUS SPORTS LIVE DATA" / "BETFAIR EXCHANGE" / "< 250ms LATENCY" / "FULLY AUTOMATED" repeated

### 3.3 Features Section (4-column bento grid from B)
Six feature cards in bento layout (2 large + 4 small):
1. **Real-Time Data Ingestion** — Genius Sports Ably stream, <250ms latency
2. **Automated Execution** — Betfair Exchange REST + Stream API, no manual input
3. **Smart Order Management** — Lay/Back logic, in-play position tracking
4. **Risk Controls** — Per-match exposure limits, daily loss caps, auto-pause
5. **Performance Analytics** — P&L tracking, win rate, edge analysis
6. **Audit Trail** — Full trade log with timestamps, reasoning, and outcomes

Cards: `bg-zinc-900 border border-zinc-800`, hover state adds `border-sky-500/40` + faint blue glow

### 3.4 How It Works (2-column sticky scroll from C, with step connectors)
Numbered pipeline steps — left column is sticky label, right column scrolls:
1. **Ingest** — Genius Sports WebSocket data arrives via Ably (<250ms)
2. **Analyze** — Signal logic evaluates live match state, odds movement, value threshold
3. **Decide** — Strategy engine generates order parameters (market, selection, price, stake)
4. **Execute** — Betfair Exchange API places the bet; confirmation logged
5. **Monitor** — Open positions tracked; exit/hedge triggered on conditions

Connectors between steps: vertical blue dashed line with step numbers in blue circles

### 3.5 Stats Bar (full-width)
Three or four large stats, centered, separated by vertical dividers:
- `< 250ms` — Data Latency
- `5,000` — API Transactions / Hour
- `100%` — Automated Execution
- `24/7` — Always-On Monitoring

Large numbers in white (Space Grotesk bold), labels below in zinc-400

### 3.6 CTA / Footer Section
- Full-width dark section, subtle blue top border line
- Center-aligned: headline + subtext + "Request Access" button
- Below: minimal footer — `© 2026 Bettrade` + disclaimer line ("Private preview — not for public distribution")

---

## 4. Technical Architecture

### Stack
- **Framework:** Next.js 15 (App Router, latest stable)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Animations:** Framer Motion (scroll animations, marquee, counter animations)
- **Fonts:** Google Fonts via `next/font` — Space Grotesk + JetBrains Mono

### Project Structure
```
bettrade/
├── app/
│   ├── layout.tsx          # Root layout, font setup, metadata
│   └── page.tsx            # Landing page — imports all sections
├── components/
│   ├── nav.tsx             # Fixed navigation bar
│   ├── hero.tsx            # Hero section with execution panel
│   ├── marquee.tsx         # Scrolling ticker
│   ├── features.tsx        # Bento grid features
│   ├── how-it-works.tsx    # Pipeline steps section
│   ├── stats.tsx           # Stats bar
│   └── cta.tsx             # CTA + footer
├── public/                 # Static assets if needed
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

### Key Implementation Notes
- All sections are **server components** (no `"use client"` unless needed for animations/interactivity)
- Framer Motion scroll animations use `"use client"` wrapper components where necessary
- The live execution panel uses **static mock data** (no real API calls) — animated with a CSS/JS typewriter/scroll effect
- No backend, no auth, no database — pure static marketing page
- Deployable as a static export (`next export`) or as a Node server behind Caddy at port `4000`

---

## 5. Content (Copy)

### Hero Headline
> "Trade the Market. Beat the Speed."

### Hero Subheadline
> Bettrade connects Genius Sports real-time match intelligence directly to the Betfair Exchange — analyzing signals, sizing positions, and executing orders in under 250 milliseconds. No dashboards. No delays. Just automated edge.

### Features Section Header
> "Everything the edge needs."

### How It Works Header
> "From data to execution in milliseconds."

### Stats Section (no header needed — let numbers speak)

### CTA Header
> "Built for serious traders."

### CTA Subtext
> Bettrade is currently in private preview. If you're interested in early access, get in touch.

---

## 6. Out of Scope

- User authentication / login
- Real Betfair API integration on the frontend
- Real Genius Sports data on the frontend
- Dark/light mode toggle
- Blog, docs pages, or multi-page routing
- Mobile app or PWA features
- Internationalization

---

## 7. Deployment Target

The page will run on port `4000` behind the existing Caddy reverse proxy at `psychoff.com`. A new Caddyfile entry will be needed (out of scope for this spec — handled separately).

'use client'

import { useCallback, useEffect, useState } from 'react'
import Nav from '@/components/nav'

const ENGINE = process.env.NEXT_PUBLIC_ENGINE_URL ?? 'http://localhost:4001'
const TOKEN = process.env.NEXT_PUBLIC_SCALPY_ADMIN_TOKEN

interface Control {
  killed: boolean
  killReason: string | null
  killedBy: string | null
  killedAt: string | null
  trackingPaused: boolean
  tradingDay: string
  realizedPnlToday: number
  consecutiveLosses: number
  persistenceAvailable: boolean
}
interface Status {
  control: Control
  dryRun: boolean
  liveArmed: boolean
  manualArm: boolean
  openLiability: { total: number; count: number } | null
  brakes: Record<string, number | boolean> | null
  stake: number
  maxStakeHardCap: number | null
}
interface Decision {
  ts: string
  match?: string
  action: 'PLACED' | 'MATCHED' | 'PARTIAL_MATCH' | 'UNMATCHED' | 'SETTLED'
        | 'SKIPPED' | 'BLOCKED' | 'DEFERRED' | 'ANNOUNCE' | 'ENGINE' | 'ERROR'
  reason?: string
  brake?: string
  detail?: string
  price?: number
  stake?: number
  marketType?: string
  matchedSize?: number
  matchedPrice?: number
  betStatus?: string
}

const actionColor: Record<string, string> = {
  PLACED: 'text-emerald-400',
  MATCHED: 'text-emerald-300',
  PARTIAL_MATCH: 'text-amber-300',
  UNMATCHED: 'text-zinc-500',
  SETTLED: 'text-sky-300',
  BLOCKED: 'text-rose-400',
  SKIPPED: 'text-zinc-400',
  DEFERRED: 'text-amber-400',
  ANNOUNCE: 'text-sky-400',   // 2nd-half stoppage announcement seen by the engine
  ENGINE: 'text-violet-300',  // engine (re)start marker
  ERROR: 'text-rose-400',
}

// ── Inline SVG icons (Lucide-style, no emoji) ──────────────────────────────
const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const PowerIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...sw} className={className} aria-hidden="true"><line x1="12" x2="12" y1="2" y2="12" /><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /></svg>
)
const ShieldIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...sw} className={className} aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
)
const PlayIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
)
const PauseIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...sw} className={className} aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
)
const AlertIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...sw} className={className} aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
)
const TargetIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" {...sw} className={className} aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
)

export default function AdminPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [log, setLog] = useState<Decision[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (TOKEN) h['X-Scalpy-Admin'] = TOKEN
    return h
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        fetch(`${ENGINE}/api/scalpy/control`).then((r) => r.json()),
        fetch(`${ENGINE}/api/scalpy/log?limit=40`).then((r) => r.json()),
      ])
      if (s.ok) setStatus(s)
      if (l.ok) setLog(l.decisions)
      setConnected(true)
      setErr(null)
    } catch (e) {
      setConnected(false)
      setErr(e instanceof Error ? e.message : 'connection failed')
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh])

  const sendControl = async (action: 'kill' | 'resume' | 'reset_circuit_breaker') => {
    setBusy(true)
    try {
      const r = await fetch(`${ENGINE}/api/scalpy/control`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ action, reason: action === 'kill' ? 'manual_panel_kill' : undefined }),
      })
      if (!r.ok) setErr(`control ${action} → HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'control failed')
    }
    setBusy(false)
  }

  const c = status?.control
  const killed = !!c?.killed
  const dryRun = status?.dryRun ?? true
  const manualArm = status?.manualArm ?? false
  const lossLimit = Number(status?.brakes?.dailyRealizedLossLimit ?? 20)
  const pnl = c?.realizedPnlToday ?? 0
  const lossPct = Math.min(100, Math.max(0, (-pnl / lossLimit) * 100))
  const liab = status?.openLiability
  const maxLiab = Number(status?.brakes?.maxTotalOpenLiability ?? 20)
  const consecutiveLosses = c?.consecutiveLosses ?? 0
  const cbThreshold = Number(status?.brakes?.circuitBreakerLosses ?? 5)
  // The circuit breaker blocks every new bet the moment consecutiveLosses hits the threshold — this
  // check is INDEPENDENT of `killed` (a resume() only clears the kill flag; canPlaceBet still reads
  // this counter directly), so the bot can be silently frozen with killed:false and no other visible
  // alarm. Surface it loudly and give a direct way to clear it (2026-07-12 incident).
  const circuitBreakerTripped = consecutiveLosses >= cbThreshold

  const now = Date.now()
  const placedIn = (m: number) => log.filter((d) => d.action === 'PLACED' && now - new Date(d.ts).getTime() < m * 60000).length
  const blockedIn = (m: number) => log.filter((d) => d.action === 'BLOCKED' && now - new Date(d.ts).getTime() < m * 60000).length

  const togglePause = async () => {
    setBusy(true)
    try {
      const r = await fetch(`${ENGINE}/api/scalpy/control`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ pauseTracking: !c?.trackingPaused }),
      })
      if (!r.ok) setErr(`pause → HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'pause failed')
    }
    setBusy(false)
  }

  const onResume = () => {
    if (c?.killedBy === 'auto' && !window.confirm(`AUTO-KILL: "${c?.killReason}". Resume trading anyway?`)) return
    sendControl('resume')
  }

  const onResetCircuitBreaker = () => {
    if (!window.confirm(`Reset the consecutive-loss streak (currently ${consecutiveLosses}/${cbThreshold}) and let betting resume?`)) return
    sendControl('reset_circuit_breaker')
  }

  const toggleManualArm = async () => {
    const next = !manualArm
    const msg = next
      ? 'Manual-arm ON: every tracked match becomes DISARMED. Only matches you arm with the eye will bet. Continue?'
      : 'Manual-arm OFF: every tracked match becomes ARMED and can bet again. Continue?'
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      const r = await fetch(`${ENGINE}/api/scalpy/control`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ manualArm: next }),
      })
      if (!r.ok) setErr(`manual-arm → HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'manual-arm failed')
    }
    setBusy(false)
  }

  const btn =
    'inline-flex items-center gap-2 font-mono font-bold cursor-pointer transition-all duration-200 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'
  const btnPress = 'hover:scale-[1.015] active:scale-[0.98]'

  // Stat-cell hairline dividers — one instrument band instead of 4 separate cards (2x2 on mobile, 1x4 from sm).
  const cellBorders = [
    'border-b sm:border-b-0 border-r',
    'border-b sm:border-b-0 sm:border-r',
    'border-r',
    '',
  ]

  return (
    <>
      <Nav />
      <main className="relative pt-14 min-h-screen">
        <div className="pointer-events-none fixed inset-0 bg-grid opacity-40" />
        <div aria-hidden className="pointer-events-none fixed -top-32 right-[-10%] w-[600px] h-[600px] rounded-full sc-glow-orb" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-6">

          {/* Header — eyebrow + sans display, matches Scalpy / Results */}
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400 mb-3">Safety Control</p>
              <h1 className="font-sans font-bold text-3xl sm:text-4xl tracking-tight text-zinc-50">Admin</h1>
              <p className="font-sans text-sm text-zinc-400 mt-2">Scalpy safety control panel</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-2 text-xs font-mono text-zinc-500 px-2.5 py-1.5 rounded-md border border-[var(--sc-hairline)]">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                {connected ? 'connected' : 'offline'}
              </span>
              <span
                className={`text-xs font-mono font-bold px-3 py-1.5 rounded-md border ${
                  dryRun
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                    : 'bg-rose-600/20 text-rose-300 border-rose-500/60 animate-pulse'
                }`}
              >
                {dryRun ? 'DRY RUN' : 'LIVE · REAL MONEY'}
              </span>
            </div>
          </div>

          {/* Banners — semantic colors untouched; depth + radius brought in line with the rest of the app */}
          {err && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-mono text-rose-300 shadow-[var(--sc-shadow)]">
              <AlertIcon className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}
          {c && !c.persistenceAvailable && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-mono text-amber-300 shadow-[var(--sc-shadow)]">
              <AlertIcon className="w-4 h-4 shrink-0" />
              <span>Control persistence OFF — apply the <code className="text-amber-200">scalpy_control</code> migration (kill-switch won&apos;t survive restart).</span>
            </div>
          )}
          {circuitBreakerTripped && (
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-mono text-rose-300 shadow-[var(--sc-shadow)]">
              <div className="flex items-center gap-2">
                <AlertIcon className="w-4 h-4 shrink-0" />
                <span>
                  Circuit breaker tripped — {consecutiveLosses}/{cbThreshold} consecutive losses. Every new bet is being silently
                  blocked{!killed && ' even though the engine shows RUNNING'} — resuming from a kill does <u>not</u> clear this by itself.
                </span>
              </div>
              <button
                type="button" disabled={busy} onClick={onResetCircuitBreaker} aria-label="Reset circuit breaker"
                className={`${btn} ${btnPress} shrink-0 text-xs px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white focus-visible:ring-rose-400`}
              >
                <PowerIcon className="w-3.5 h-3.5" /> Reset circuit breaker
              </button>
            </div>
          )}

          {/* Kill switch — hero */}
          <div className={`rounded-2xl border p-6 shadow-[var(--sc-shadow-hero)] ${killed ? 'border-rose-500/40 bg-rose-500/[0.07]' : 'border-emerald-500/30 bg-emerald-500/[0.06]'}`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${killed ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                  {killed ? <PowerIcon className="w-6 h-6" /> : <ShieldIcon className="w-6 h-6" />}
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">Engine state</div>
                  <div className={`text-2xl font-mono font-bold ${killed ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {killed ? 'KILLED' : 'RUNNING'}
                  </div>
                  {killed && c?.killReason && (
                    <div className="text-xs font-mono text-rose-300/70 mt-0.5">
                      {c.killReason}{c.killedBy ? ` · ${c.killedBy}` : ''}
                    </div>
                  )}
                </div>
              </div>
              {killed ? (
                <button
                  type="button" disabled={busy} onClick={onResume} aria-label="Resume engine"
                  className={`${btn} ${btnPress} px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-lg shadow-[var(--sc-shadow)] focus-visible:ring-emerald-400`}
                >
                  <PlayIcon className="w-5 h-5" /> RESUME
                </button>
              ) : (
                <button
                  type="button" disabled={busy} onClick={() => sendControl('kill')} aria-label="Kill engine — stop all betting"
                  className={`${btn} ${btnPress} px-8 py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xl shadow-[var(--sc-shadow)] focus-visible:ring-rose-400`}
                >
                  <PowerIcon className="w-6 h-6" /> KILL
                </button>
              )}
            </div>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <button
                type="button" disabled={busy} onClick={togglePause}
                className={`${btn} text-xs px-3 py-1.5 rounded-lg border focus-visible:ring-zinc-400 ${
                  c?.trackingPaused
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-[var(--sc-hairline)] text-zinc-400 hover:text-white hover:border-white/20'
                }`}
              >
                <PauseIcon className="w-3.5 h-3.5" />
                {c?.trackingPaused ? 'Tracking paused — resume tracking' : 'Pause tracking too'}
              </button>
              <button
                type="button" disabled={busy} onClick={toggleManualArm}
                aria-label="Toggle manual-arm mode"
                className={`${btn} text-xs px-3 py-1.5 rounded-lg border focus-visible:ring-sky-400 ${
                  manualArm
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                    : 'border-[var(--sc-hairline)] text-zinc-400 hover:text-white hover:border-white/20'
                }`}
              >
                <TargetIcon className="w-3.5 h-3.5" />
                {manualArm ? 'Manual-arm ON — arm matches with the eye' : 'Manual-arm: test one match first'}
              </button>
              <span className="text-[10px] font-mono text-zinc-600">
                Kill stops betting; pausing also stops watching new fixtures. Manual-arm disarms every match until you arm it.
              </span>
            </div>
          </div>

          {/* Stat strip — one hairline-divided instrument band, matches ScalpySummaryBar */}
          <div className="sc-card sc-rise overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <Stat
                label="Today P&L vs limit" value={`£${pnl.toFixed(2)} / -£${lossLimit}`}
                valueColor={pnl < 0 ? 'var(--color-rose-400)' : 'var(--color-emerald-400)'}
                borderClass={cellBorders[0]}
              >
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${lossPct > 70 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${lossPct}%` }} />
                </div>
              </Stat>
              <Stat
                label="Open liability" value={liab ? `£${liab.total.toFixed(2)} / £${maxLiab}` : '—'}
                sub={liab ? `${liab.count} open bet${liab.count !== 1 ? 's' : ''}` : undefined}
                borderClass={cellBorders[1]}
              />
              <Stat
                label="Consecutive losses"
                value={`${consecutiveLosses} / ${cbThreshold}`}
                valueColor={circuitBreakerTripped ? 'var(--color-rose-400)' : consecutiveLosses >= Math.max(1, cbThreshold - 2) ? 'var(--color-amber-400)' : undefined}
                borderClass={cellBorders[2]}
              >
                {circuitBreakerTripped && (
                  <button
                    type="button" disabled={busy} onClick={onResetCircuitBreaker} aria-label="Reset circuit breaker"
                    className={`${btn} ${btnPress} mt-2 w-full justify-center text-[10px] px-2.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white focus-visible:ring-rose-400`}
                  >
                    Reset — unblock betting
                  </button>
                )}
              </Stat>
              <Stat
                label="Bet rate (5m)" value={`${placedIn(5)} placed`}
                sub={`${blockedIn(5)} blocked · ${placedIn(15)}/15m`}
                valueColor={placedIn(5) >= 10 ? 'var(--color-amber-400)' : undefined}
                borderClass={cellBorders[3]}
              />
            </div>
          </div>

          {/* Decision log — panel header band + hairline table, matches the trades table */}
          <section className="sc-card overflow-hidden">
            <h2 className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--sc-hairline)]">
              <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.15em]">
                <span className="sc-live-dot text-sky-400" />Recent decisions
              </span>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{log.length} entries</span>
            </h2>
            <div className="overflow-x-auto scrollbar-none">
              {log.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-zinc-600 font-mono text-sm">
                  <span className="sc-live-dot text-sky-400" />No decisions yet.
                </div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[var(--sc-hairline)] text-zinc-500 text-left">
                      {['Time', 'Action', 'Match', 'Reason / brake', 'Detail'].map((h) => (
                        <th key={h} className="py-2.5 px-3 font-medium uppercase tracking-[0.15em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--sc-hairline-2)]">
                    {log.map((d, i) => (
                      <tr
                        key={i}
                        className="sc-row-in hover:bg-sky-500/5 transition-colors"
                        style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                      >
                        <td className="py-2 px-3 text-zinc-500 whitespace-nowrap">
                          {new Date(d.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className={`py-2 px-3 font-semibold ${actionColor[d.action] ?? 'text-zinc-300'}`}>{d.action}</td>
                        <td className="py-2 px-3 text-zinc-300">{d.match ?? '—'}</td>
                        <td className="py-2 px-3 text-zinc-400">{d.brake ? `${d.reason} [${d.brake}]` : d.reason ?? '—'}</td>
                        <td className="py-2 px-3 text-zinc-600">{d.detail ?? (d.price ? `@${d.price} £${d.stake}` : '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <p className="text-[10px] font-mono text-zinc-600 pt-2 border-t border-[var(--sc-hairline)]">
            Polls {ENGINE}/api/scalpy/control every 3s · trading day {c?.tradingDay ?? '—'} (Europe/Istanbul)
          </p>
        </div>
      </main>
    </>
  )
}

function Stat({ label, value, sub, valueClass, valueColor, borderClass, children }: {
  label: string; value: string; sub?: string; valueClass?: string; valueColor?: string; borderClass?: string; children?: React.ReactNode
}) {
  // `valueColor` (inline style, e.g. 'var(--color-rose-400)') is the escape hatch for the -400 shade
  // of rose/amber/emerald: those get redefined per-theme in globals.css OUTSIDE the `@theme` block,
  // and Tailwind doesn't reliably generate the corresponding `.text-*-400` utility rule for them in
  // this project — the CSS variables themselves resolve fine, so referencing them directly via inline
  // style sidesteps the gap. `valueClass` still works for static/always-present classes.
  return (
    <div className={`flex flex-col gap-1.5 px-4 py-4 sm:py-5 border-[var(--sc-hairline)] ${borderClass ?? ''}`}>
      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.15em]">{label}</div>
      <div className={`text-xl font-mono font-bold ${valueColor ? '' : valueClass ?? 'text-white'}`} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-mono text-zinc-600">{sub}</div>}
      {children}
    </div>
  )
}

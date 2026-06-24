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
  action: 'PLACED' | 'SKIPPED' | 'BLOCKED' | 'DEFERRED'
  reason?: string
  brake?: string
  detail?: string
  price?: number
  stake?: number
  marketType?: string
}

const actionColor: Record<string, string> = {
  PLACED: 'text-emerald-400',
  BLOCKED: 'text-rose-400',
  SKIPPED: 'text-zinc-400',
  DEFERRED: 'text-amber-400',
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

  const sendControl = async (action: 'kill' | 'resume') => {
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
    'inline-flex items-center gap-2 font-mono font-bold cursor-pointer transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

          {/* Header — matches Scalpy / Live Fixtures */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-mono font-bold text-white">Admin</h1>
              <p className="text-sm text-zinc-500 font-mono mt-1">Scalpy safety control panel</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-xs font-mono text-zinc-500">
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

          {/* Banners */}
          {err && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-mono text-rose-300">
              <AlertIcon className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}
          {c && !c.persistenceAvailable && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-mono text-amber-300">
              <AlertIcon className="w-4 h-4 shrink-0" />
              <span>Control persistence OFF — apply the <code className="text-amber-200">scalpy_control</code> migration (kill-switch won&apos;t survive restart).</span>
            </div>
          )}

          {/* Kill switch — hero */}
          <div className={`rounded-2xl border p-6 ${killed ? 'border-rose-500/40 bg-rose-500/[0.07]' : 'border-emerald-500/30 bg-emerald-500/[0.06]'}`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${killed ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                  {killed ? <PowerIcon className="w-6 h-6" /> : <ShieldIcon className="w-6 h-6" />}
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">Engine state</div>
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
                  className={`${btn} px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-lg focus-visible:ring-emerald-400`}
                >
                  <PlayIcon className="w-5 h-5" /> RESUME
                </button>
              ) : (
                <button
                  type="button" disabled={busy} onClick={() => sendControl('kill')} aria-label="Kill engine — stop all betting"
                  className={`${btn} px-8 py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xl focus-visible:ring-rose-400`}
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
                    : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
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
                    : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
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

          {/* Stat strip — matches ScalpySummaryBar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Today P&L vs limit" value={`£${pnl.toFixed(2)} / -£${lossLimit}`} valueClass={pnl < 0 ? 'text-rose-400' : 'text-emerald-400'}>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full transition-all duration-300 ${lossPct > 70 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${lossPct}%` }} />
              </div>
            </Stat>
            <Stat label="Open liability" value={liab ? `£${liab.total.toFixed(2)} / £${maxLiab}` : '—'}
              sub={liab ? `${liab.count} open bet${liab.count !== 1 ? 's' : ''}` : undefined} />
            <Stat label="Consecutive losses" value={String(c?.consecutiveLosses ?? 0)}
              valueClass={(c?.consecutiveLosses ?? 0) >= 3 ? 'text-amber-400' : 'text-white'} />
            <Stat label="Bet rate (5m)" value={`${placedIn(5)} placed`}
              sub={`${blockedIn(5)} blocked · ${placedIn(15)}/15m`}
              valueClass={placedIn(5) >= 10 ? 'text-amber-400' : 'text-white'} />
          </div>

          {/* Decision log — matches the trades table */}
          <section>
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recent decisions</h2>
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
              {log.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 font-mono text-sm">No decisions yet.</div>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-500 text-left">
                      {['Time', 'Action', 'Match', 'Reason / brake', 'Detail'].map((h) => (
                        <th key={h} className="py-2.5 px-3 font-medium uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {log.map((d, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
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

          <p className="text-[10px] font-mono text-zinc-600">
            Polls {ENGINE}/api/scalpy/control every 3s · trading day {c?.tradingDay ?? '—'} (Europe/Istanbul)
          </p>
        </div>
      </main>
    </>
  )
}

function Stat({ label, value, sub, valueClass, children }: {
  label: string; value: string; sub?: string; valueClass?: string; children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-1">
      <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-mono font-bold ${valueClass ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-zinc-600">{sub}</div>}
      {children}
    </div>
  )
}

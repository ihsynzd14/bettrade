'use client'

import { useCallback, useEffect, useState } from 'react'

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

export default function AdminPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [log, setLog] = useState<Decision[]>([])
  const [err, setErr] = useState<string | null>(null)
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
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'connection failed')
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh])

  const sendControl = async (action: 'kill' | 'resume', pauseTracking?: boolean) => {
    setBusy(true)
    try {
      const r = await fetch(`${ENGINE}/api/scalpy/control`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ action, pauseTracking, reason: action === 'kill' ? 'manual_panel_kill' : undefined }),
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
  const lossLimit = Number(status?.brakes?.dailyRealizedLossLimit ?? 20)
  const pnl = c?.realizedPnlToday ?? 0
  const lossPct = Math.min(100, Math.max(0, (-pnl / lossLimit) * 100))
  const liab = status?.openLiability
  const maxLiab = Number(status?.brakes?.maxTotalOpenLiability ?? 20)

  const now = Date.now()
  const placedIn = (mins: number) =>
    log.filter((d) => d.action === 'PLACED' && now - new Date(d.ts).getTime() < mins * 60000).length
  const blockedIn = (mins: number) =>
    log.filter((d) => d.action === 'BLOCKED' && now - new Date(d.ts).getTime() < mins * 60000).length

  // Toggle ONLY tracking-pause, without touching the kill state.
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

  // Auto-kills (loss limit / circuit breaker) require explicit confirmation to resume.
  const onResume = () => {
    if (c?.killedBy === 'auto' && !window.confirm(`AUTO-KILL: "${c?.killReason}". Resume trading anyway?`)) return
    sendControl('resume')
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-mono font-bold">Scalpy — Admin</h1>
            <p className="text-sm text-zinc-500 font-mono mt-1">Safety control panel</p>
          </div>
          <div className="flex items-center gap-3">
            {/* DRY / LIVE badge — loudest element */}
            <span
              className={`text-sm font-mono font-bold px-3 py-1.5 rounded-md border ${
                dryRun
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                  : 'bg-rose-600/20 text-rose-300 border-rose-500/60 animate-pulse'
              }`}
            >
              {dryRun ? 'DRY RUN' : '🔴 LIVE — REAL MONEY'}
            </span>
          </div>
        </div>

        {err && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-mono text-rose-300">⚠ {err}</div>}
        {c && !c.persistenceAvailable && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-mono text-amber-300">
            ⚠ Control persistence OFF — apply the <code>scalpy_control</code> migration (kill-switch won&apos;t survive restart).
          </div>
        )}

        {/* KILL SWITCH */}
        <div
          className={`rounded-2xl border p-6 ${
            killed ? 'border-rose-500/50 bg-rose-500/10' : 'border-emerald-500/30 bg-emerald-500/5'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">Engine state</div>
              <div className={`text-3xl font-mono font-bold mt-1 ${killed ? 'text-rose-400' : 'text-emerald-400'}`}>
                {killed ? 'KILLED' : 'RUNNING'}
              </div>
              {killed && c?.killReason && (
                <div className="text-xs font-mono text-rose-300/80 mt-1">
                  {c.killReason} {c.killedBy ? `· by ${c.killedBy}` : ''}
                </div>
              )}
            </div>
            {killed ? (
              <button
                disabled={busy}
                onClick={onResume}
                className="px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-lg disabled:opacity-50"
              >
                ▶ RESUME
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => sendControl('kill')}
                className="px-8 py-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xl disabled:opacity-50"
              >
                ■ KILL
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              disabled={busy}
              onClick={togglePause}
              className={`text-xs font-mono px-3 py-1.5 rounded border transition-colors ${
                c?.trackingPaused
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              {c?.trackingPaused ? '⏸ Tracking paused — resume tracking' : 'Pause tracking too'}
            </button>
            <span className="text-[10px] font-mono text-zinc-600">
              (Kill stops betting; pausing also stops watching new fixtures)
            </span>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Today P&L vs limit" valueClass={pnl < 0 ? 'text-rose-400' : 'text-emerald-400'}
            value={`£${pnl.toFixed(2)} / -£${lossLimit}`}>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full ${lossPct > 70 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${lossPct}%` }} />
            </div>
          </Stat>
          <Stat label="Open liability" value={liab ? `£${liab.total.toFixed(2)} / £${maxLiab}` : '—'}
            sub={liab ? `${liab.count} open bet${liab.count !== 1 ? 's' : ''}` : undefined} />
          <Stat label="Consecutive losses" value={String(c?.consecutiveLosses ?? 0)}
            valueClass={(c?.consecutiveLosses ?? 0) >= 3 ? 'text-amber-400' : 'text-white'} />
          <Stat label="Bet rate (5m)" value={`${placedIn(5)} placed`}
            sub={`${blockedIn(5)} blocked · ${placedIn(15)} placed/15m`}
            valueClass={placedIn(5) >= 10 ? 'text-amber-400' : 'text-white'} />
        </div>

        {/* Decision log */}
        <section>
          <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2">Recent decisions</h2>
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
            {log.length === 0 ? (
              <div className="text-center py-10 text-zinc-600 font-mono text-sm">No decisions yet.</div>
            ) : (
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-left">
                    {['Time', 'Action', 'Match', 'Reason / brake', 'Detail'].map((h) => (
                      <th key={h} className="py-2 px-3 font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {log.map((d, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="py-1.5 px-3 text-zinc-500">
                        {new Date(d.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className={`py-1.5 px-3 font-semibold ${actionColor[d.action] ?? 'text-zinc-300'}`}>{d.action}</td>
                      <td className="py-1.5 px-3 text-zinc-300">{d.match ?? '—'}</td>
                      <td className="py-1.5 px-3 text-zinc-400">{d.brake ? `${d.reason} [${d.brake}]` : d.reason ?? '—'}</td>
                      <td className="py-1.5 px-3 text-zinc-600">{d.detail ?? (d.price ? `@${d.price} £${d.stake}` : '')}</td>
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
  )
}

function Stat({ label, value, sub, valueClass, children }: {
  label: string; value: string; sub?: string; valueClass?: string; children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-mono font-bold mt-0.5 ${valueClass ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-zinc-600 mt-0.5">{sub}</div>}
      {children}
    </div>
  )
}

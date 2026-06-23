'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Refreshes the page at the next Europe/Istanbul midnight so the Scalpy tab's "today" window
 * rolls over. Correctness lives server-side (the query window is computed per request); this
 * only nudges the UI. Re-arms on focus/visibility in case the timer was missed (laptop sleep).
 */
export function DailyRollover() {
  const router = useRouter()

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const schedule = () => {
      const now = new Date()
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now)
      const todayMidnight = new Date(`${day}T00:00:00+03:00`)
      const nextMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000)
      const ms = Math.max(1000, nextMidnight.getTime() - now.getTime()) + 1000
      timeout = setTimeout(() => { router.refresh(); schedule() }, ms)
    }
    schedule()

    const onWake = () => { if (document.visibilityState === 'visible') router.refresh() }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [router])

  return null
}

export function getLocalPickDate(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getNextLocalMidnight(now: Date): Date {
  const midnight = new Date(now.getTime())
  // Advance the calendar date, including local daylight-saving transitions.
  midnight.setDate(midnight.getDate() + 1)
  midnight.setHours(0, 0, 0, 0)
  return midnight
}

export function getRemainingSeconds(now: Date, until = getNextLocalMidnight(now)): number {
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 1_000))
}

export function formatRemainingTime(seconds: number): string {
  const remaining = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(remaining / 3_600)
  const minutes = Math.floor((remaining % 3_600) / 60)
  const secs = remaining % 60
  return [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':')
}

type EventSource = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export type LocalClockEnvironment = {
  now: () => Date
  startInterval: (tick: () => void) => () => void
  windowEvents: EventSource
  documentEvents: EventSource & { readonly visibilityState: string }
}

export function watchLocalClock(
  onTick: (remaining: string) => void,
  onDateChange: (date: string) => void,
  environment: LocalClockEnvironment = {
    now: () => new Date(),
    startInterval: (tick) => {
      const interval = window.setInterval(tick, 1_000)
      return () => window.clearInterval(interval)
    },
    windowEvents: window,
    documentEvents: document,
  },
): () => void {
  let previousDate: string | undefined

  function tick() {
    const now = environment.now()
    const date = getLocalPickDate(now)
    onTick(formatRemainingTime(getRemainingSeconds(now)))
    if (date !== previousDate) {
      previousDate = date
      onDateChange(date)
    }
  }

  function resume() {
    if (environment.documentEvents.visibilityState === 'visible') tick()
  }

  tick()
  const stopInterval = environment.startInterval(tick)
  environment.documentEvents.addEventListener('visibilitychange', resume)
  environment.windowEvents.addEventListener('focus', resume)
  environment.windowEvents.addEventListener('pageshow', resume)

  return () => {
    stopInterval()
    environment.documentEvents.removeEventListener('visibilitychange', resume)
    environment.windowEvents.removeEventListener('focus', resume)
    environment.windowEvents.removeEventListener('pageshow', resume)
  }
}

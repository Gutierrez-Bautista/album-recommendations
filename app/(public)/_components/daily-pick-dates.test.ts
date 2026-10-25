import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatRemainingTime,
  getLocalPickDate,
  getNextLocalMidnight,
  getRemainingSeconds,
  watchLocalClock,
} from './daily-pick-dates'

afterEach(() => vi.unstubAllEnvs())

describe('browser local calendar', () => {
  it('uses the previous local date in UTC−3 instead of the UTC date', () => {
    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires')
    const now = new Date('2026-10-25T01:02:03.000Z')

    expect(getLocalPickDate(now)).toBe('2026-10-24')
    expect(getNextLocalMidnight(now).toISOString()).toBe('2026-10-25T03:00:00.000Z')
    expect(formatRemainingTime(getRemainingSeconds(now))).toBe('01:57:57')
  })

  it('uses the next local date in UTC+14', () => {
    vi.stubEnv('TZ', 'Pacific/Kiritimati')
    const now = new Date('2026-10-24T12:30:00.000Z')

    expect(getLocalPickDate(now)).toBe('2026-10-25')
    expect(getNextLocalMidnight(now).toISOString()).toBe('2026-10-25T10:00:00.000Z')
    expect(formatRemainingTime(getRemainingSeconds(now))).toBe('21:30:00')
  })

  it('pads single digit months and days and advances across a year boundary', () => {
    vi.stubEnv('TZ', 'Etc/UTC')
    expect(getLocalPickDate(new Date('2026-01-02T12:00:00Z'))).toBe('2026-01-02')
    const now = new Date('2026-12-31T23:59:59.500Z')
    expect(getNextLocalMidnight(now).toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(getLocalPickDate(getNextLocalMidnight(now))).toBe('2027-01-01')
    expect(formatRemainingTime(getRemainingSeconds(now))).toBe('00:00:01')
    expect(now.toISOString()).toBe('2026-12-31T23:59:59.500Z')
  })

  it('computes the next midnight of a 23 hour daylight-saving day', () => {
    vi.stubEnv('TZ', 'America/New_York')
    const now = new Date('2026-03-08T05:00:00.000Z')

    expect(getLocalPickDate(now)).toBe('2026-03-08')
    expect(getNextLocalMidnight(now).toISOString()).toBe('2026-03-09T04:00:00.000Z')
    expect(formatRemainingTime(getRemainingSeconds(now))).toBe('23:00:00')
  })

  it('allows 25 hours remaining on a daylight-saving fallback day', () => {
    vi.stubEnv('TZ', 'America/New_York')
    const now = new Date('2026-11-01T04:00:00.000Z')

    expect(getNextLocalMidnight(now).toISOString()).toBe('2026-11-02T05:00:00.000Z')
    expect(formatRemainingTime(getRemainingSeconds(now))).toBe('25:00:00')
  })

  it('clamps expired countdowns and formats hours without a 24 hour wrap', () => {
    expect(formatRemainingTime(27 * 3_600 + 2 * 60 + 9)).toBe('27:02:09')
    expect(formatRemainingTime(-2)).toBe('00:00:00')
    expect(getRemainingSeconds(new Date(2_000), new Date(1_000))).toBe(0)
  })
})

function clockEnvironment(initial: string) {
  let now = new Date(initial)
  let intervalTick = () => {}
  const windowEvents = new EventTarget()
  const documentEvents = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const stopInterval = vi.fn()
  const environment = {
    now: () => now,
    startInterval: vi.fn((tick: () => void) => {
      intervalTick = tick
      return stopInterval
    }),
    windowEvents,
    documentEvents,
  }
  return {
    environment,
    stopInterval,
    tick: () => intervalTick(),
    setTime: (time: string) => { now = new Date(time) },
  }
}

describe('local clock subscriptions', () => {
  it('derives every tick from the current clock and only emits changed dates', () => {
    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires')
    const clock = clockEnvironment('2026-10-25T02:59:50Z')
    const onTick = vi.fn()
    const onDateChange = vi.fn()
    const stop = watchLocalClock(onTick, onDateChange, clock.environment)

    expect(onTick).toHaveBeenLastCalledWith('00:00:10')
    expect(onDateChange).toHaveBeenCalledExactlyOnceWith('2026-10-24')
    clock.setTime('2026-10-25T02:59:57Z')
    clock.tick()
    expect(onTick).toHaveBeenLastCalledWith('00:00:03')
    expect(onDateChange).toHaveBeenCalledTimes(1)

    clock.setTime('2026-10-25T03:00:02Z')
    clock.tick()
    expect(onTick).toHaveBeenLastCalledWith('23:59:58')
    expect(onDateChange).toHaveBeenLastCalledWith('2026-10-25')
    expect(onDateChange).toHaveBeenCalledTimes(2)
    stop()
  })

  it.each(['visibilitychange', 'focus', 'pageshow'])(
    'detects a skipped local midnight when a suspended tab resumes through %s',
    (event) => {
      vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires')
      const clock = clockEnvironment('2026-10-25T01:00:00Z')
      const onDateChange = vi.fn()
      const stop = watchLocalClock(vi.fn(), onDateChange, clock.environment)

      clock.setTime('2026-10-26T15:00:00Z')
      const source = event === 'visibilitychange'
        ? clock.environment.documentEvents
        : clock.environment.windowEvents
      source.dispatchEvent(new Event(event))

      expect(onDateChange).toHaveBeenLastCalledWith('2026-10-26')
      expect(onDateChange).toHaveBeenCalledTimes(2)
      stop()
    },
  )

  it('recomputes local date and countdown after changing the device time zone', () => {
    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires')
    const clock = clockEnvironment('2026-10-25T01:00:00Z')
    const onTick = vi.fn()
    const onDateChange = vi.fn()
    const stop = watchLocalClock(onTick, onDateChange, clock.environment)
    expect(onDateChange).toHaveBeenLastCalledWith('2026-10-24')

    vi.stubEnv('TZ', 'Pacific/Kiritimati')
    clock.environment.windowEvents.dispatchEvent(new Event('focus'))

    expect(onDateChange).toHaveBeenLastCalledWith('2026-10-25')
    expect(onTick).toHaveBeenLastCalledWith('09:00:00')
    stop()
  })

  it('updates the countdown without emitting the same date on a time zone change', () => {
    vi.stubEnv('TZ', 'Etc/UTC')
    const clock = clockEnvironment('2026-10-25T15:00:00Z')
    const onTick = vi.fn()
    const onDateChange = vi.fn()
    const stop = watchLocalClock(onTick, onDateChange, clock.environment)
    expect(onTick).toHaveBeenLastCalledWith('09:00:00')

    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires')
    clock.environment.windowEvents.dispatchEvent(new Event('focus'))
    expect(onTick).toHaveBeenLastCalledWith('12:00:00')
    expect(onDateChange).toHaveBeenCalledTimes(1)
    stop()
  })

  it('ignores visibility events while hidden and removes every listener on cleanup', () => {
    vi.stubEnv('TZ', 'Etc/UTC')
    const clock = clockEnvironment('2026-10-25T15:00:00Z')
    const onTick = vi.fn()
    const onDateChange = vi.fn()
    const stop = watchLocalClock(onTick, onDateChange, clock.environment)
    clock.environment.documentEvents.visibilityState = 'hidden'
    clock.environment.documentEvents.dispatchEvent(new Event('visibilitychange'))
    expect(onTick).toHaveBeenCalledTimes(1)

    stop()
    clock.environment.documentEvents.visibilityState = 'visible'
    clock.environment.documentEvents.dispatchEvent(new Event('visibilitychange'))
    clock.environment.windowEvents.dispatchEvent(new Event('focus'))
    clock.environment.windowEvents.dispatchEvent(new Event('pageshow'))
    expect(clock.stopInterval).toHaveBeenCalledOnce()
    expect(onTick).toHaveBeenCalledTimes(1)
    expect(onDateChange).toHaveBeenCalledTimes(1)
  })
})
